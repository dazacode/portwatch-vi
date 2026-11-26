import * as Tone from "tone"
import { PLAYLIST } from "@/lib/music/playlist"
import type { Beat, Rig } from "@/lib/music/track"
import { TRACKS } from "@/lib/music/tracks"

// The soundtrack's player. The tracks (lib/music/tracks) compose and play their own bars; this
// owns the mix, the order, the change from one track to the next, and the news cues.

export type Cue = { kind: "slide" } | { kind: "milestone"; stars: number }

/** The track playing now and what it holds, so it can be faded and let go. */
type Playing = {
  index: number
  out: Tone.Volume
  nodes: Tone.ToneAudioNode[]
  play: (beat: Beat) => void
  bars: number
  swing: number
  bpm: number
  n: number
}

/** Builds the mix and the cue instruments; the tracks come and go inside it. */
export function createScore(onTrack: (index: number) => void) {
  const master = new Tone.Volume(-6).connect(new Tone.Limiter(-2).toDestination())
  const room = new Tone.Reverb({ decay: 2.4, wet: 1 }).connect(new Tone.Volume(-12).connect(master))
  const echo = new Tone.PingPongDelay({ delayTime: "8n.", feedback: 0.32, wet: 1 }).connect(
    new Tone.Volume(-15).connect(master)
  )
  const transport = Tone.getTransport()

  // The news cues, the same over every track.
  const brass = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.6, release: 0.4 },
  }).connect(new Tone.Filter(2600, "lowpass").connect(new Tone.Volume(-19).connect(master)))
  brass.connect(room)
  const sweep = new Tone.Filter(400, "bandpass").connect(new Tone.Volume(-19).connect(master))
  sweep.connect(room)
  const whoosh = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.18, decay: 0.35, sustain: 0 },
  }).connect(sweep)
  let lastWhoosh = 0

  let current: Playing | null = null

  /** Starts a track's band; the one before fades under it and is let go. */
  function load(index: number, time: number) {
    const old = current
    if (old) {
      old.out.volume.cancelScheduledValues(time)
      old.out.volume.rampTo(-80, 1.5, time)
      window.setTimeout(() => {
        for (const node of old.nodes) node.dispose()
      }, 3000)
    }
    const id = PLAYLIST[index].id
    const track = TRACKS[id]
    const out = new Tone.Volume(0).connect(master)
    const nodes: Tone.ToneAudioNode[] = [out]
    const keep = <T extends Tone.ToneAudioNode>(node: T) => {
      nodes.push(node)
      return node
    }
    const rig: Rig = {
      keep,
      channel(db, sends = []) {
        const fader = keep(new Tone.Volume(db)).connect(out)
        for (const s of sends) fader.connect(s === "room" ? room : echo)
        return fader
      },
    }
    current = {
      index,
      out,
      nodes,
      play: track.build(rig),
      bars: track.bars,
      swing: track.swing ?? 0,
      bpm: track.bpm,
      n: 0,
    }
    transport.bpm.setValueAtTime(track.bpm, time)
    onTrack(index)
  }

  // One loop plays every track, a bar at a time.
  const bar = new Tone.Loop((time) => {
    if (!current) return
    if (current.n >= current.bars) load((current.index + 1) % PLAYLIST.length, time)
    const { swing, bpm } = current
    // From the track's own tempo: the transport's can still be the last track's at this instant.
    const step = 60 / bpm / 4
    const n = current.n++
    current.play({
      time,
      n,
      step,
      at: (s) => time + s * step + (swing && Math.floor(s) % 4 === 2 ? swing * step : 0),
    })
  }, "1m")

  return {
    /** Once. Everything is then kept silent or audible by play and pause. */
    prepare(index = 0) {
      load(index, Tone.now())
      bar.start(0)
    },
    play(volume: number) {
      transport.start()
      this.volume(volume)
    },
    pause() {
      transport.pause()
      master.volume.rampTo(-60, 0.3)
    },
    /** 0 to 1. */
    volume(v: number) {
      master.volume.rampTo(v <= 0 ? -60 : Tone.gainToDb(v) + 6, 0.2)
    },
    /** Jumps to a track now, from its first bar. */
    select(index: number) {
      const playing = transport.state === "started"
      transport.stop()
      load(((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length, Tone.now())
      if (playing) transport.start("+0.05")
    },
    next() {
      this.select((current?.index ?? -1) + 1)
    },
    previous() {
      this.select((current?.index ?? 1) - 1)
    },
    cue(cue: Cue) {
      const now = Tone.now() + 0.03
      if (cue.kind === "slide") {
        // One source plays this, so a burst of slides gets one whoosh.
        if (now - lastWhoosh < 0.8) return
        lastWhoosh = now
        sweep.frequency.cancelScheduledValues(now)
        sweep.frequency.setValueAtTime(300, now)
        sweep.frequency.exponentialRampToValueAtTime(5000, now + 0.4)
        whoosh.triggerAttackRelease(0.4, now, 0.8)
        return
      }
      // A news sting: three quick notes and a held chord, taller with more stars.
      for (const [i, note] of ["D4", "D4", "A4"].entries())
        brass.triggerAttackRelease(note, 0.1, now + i * 0.14, 0.7)
      const top = ["D4", "A4", "D5", "F5", "A5"].slice(0, Math.max(2, cue.stars))
      brass.triggerAttackRelease(top, 0.4 + cue.stars * 0.14, now + 0.46, 0.85)
    },
  }
}

export type Score = ReturnType<typeof createScore>

/** Must be called from a click: browsers keep audio silent until one. */
export async function openScore(onTrack: (index: number) => void) {
  await Tone.start()
  return createScore(onTrack)
}
