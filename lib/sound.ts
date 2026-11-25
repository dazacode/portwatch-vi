import * as Tone from "tone"

// An original score, played by synthesizers in the browser. There are no audio files and nothing to
// license: 80s Miami synths, congas, clave and steel drum over a newsroom pulse and the ocean.

const BPM = 108
const CHORDS = [
  ["D3", "F3", "A3", "C4", "E4"],
  ["A#2", "D3", "F3", "A3", "C4"],
  ["G2", "A#2", "D3", "F3", "A3"],
  ["A2", "D3", "E3", "G3", "C#4"],
]
const ROOTS = ["D2", "A#1", "G1", "A1"]
const KICK = [0, 4, 8, 12]
const SNARE = [4, 12]
const HAT = [2, 6, 10, 14]
const CONGA_HIGH = [4, 12]
const CONGA_LOW = [6, 7, 14, 15]
// Son clave, 3-2, over two bars.
const CLAVE = [
  [0, 6, 12],
  [4, 8],
]
// Steel drum: [bar, step, note, length in steps], over four bars.
const MELODY: [number, number, string, number][] = [
  [0, 0, "A4", 3],
  [0, 3, "C5", 3],
  [0, 6, "D5", 4],
  [0, 12, "F5", 4],
  [1, 0, "D5", 6],
  [1, 8, "C5", 2],
  [1, 10, "A4", 4],
  [2, 0, "A#4", 3],
  [2, 3, "D5", 3],
  [2, 6, "F5", 4],
  [2, 12, "G5", 4],
  [3, 0, "E5", 6],
  [3, 8, "C#5", 3],
  [3, 11, "A4", 5],
]

export type Cue = { kind: "slide" } | { kind: "milestone"; stars: number }

/** Builds the band and schedules the loop on the current Tone context. */
export function createScore() {
  const master = new Tone.Volume(-6).connect(new Tone.Limiter(-2).toDestination())
  const room = new Tone.Reverb({ decay: 2.4, wet: 1 }).connect(new Tone.Volume(-12).connect(master))
  const echo = new Tone.PingPongDelay({ delayTime: "8n.", feedback: 0.32, wet: 1 }).connect(
    new Tone.Volume(-15).connect(master)
  )
  const channel = (db: number, sends: Tone.ToneAudioNode[] = []) => {
    const out = new Tone.Volume(db).connect(master)
    for (const s of sends) out.connect(s)
    return out
  }

  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
    envelope: { attack: 0.5, decay: 0.4, sustain: 0.7, release: 1.2 },
  }).connect(new Tone.Filter(1100, "lowpass").connect(channel(-25, [room])))
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.16, sustain: 0.25, release: 0.08 },
    filterEnvelope: { attack: 0.005, decay: 0.14, sustain: 0.2, baseFrequency: 140, octaves: 2.6 },
  }).connect(channel(-13))
  const arp = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.004, decay: 0.1, sustain: 0, release: 0.08 },
  }).connect(new Tone.Filter(2400, "lowpass").connect(channel(-26, [echo])))
  const steel = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 5,
    envelope: { attack: 0.004, decay: 0.5, sustain: 0.05, release: 0.5 },
    modulationEnvelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.2 },
  }).connect(channel(-17, [room, echo]))
  const kick = new Tone.MembraneSynth({ octaves: 5, pitchDecay: 0.04 }).connect(channel(-9))
  const snare = new Tone.NoiseSynth({
    envelope: { attack: 0.001, decay: 0.17, sustain: 0 },
  }).connect(new Tone.Filter(1400, "highpass").connect(channel(-18, [room])))
  const hat = new Tone.NoiseSynth({
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
  }).connect(new Tone.Filter(8000, "highpass").connect(channel(-23)))
  const conga = (db: number) =>
    new Tone.MembraneSynth({
      octaves: 1.4,
      pitchDecay: 0.012,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).connect(channel(db, [room]))
  const congaHigh = conga(-18)
  const congaLow = conga(-16)
  const clave = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).connect(channel(-24, [room]))
  const teletype = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 },
  }).connect(channel(-31, [echo]))
  const timpani = new Tone.MembraneSynth({
    octaves: 2,
    pitchDecay: 0.03,
    envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.6 },
  }).connect(channel(-13, [room]))
  const brass = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
    envelope: { attack: 0.03, decay: 0.2, sustain: 0.6, release: 0.4 },
  }).connect(new Tone.Filter(2600, "lowpass").connect(channel(-19, [room])))
  const sweep = new Tone.Filter(400, "bandpass").connect(channel(-19, [room]))
  const whoosh = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.18, decay: 0.35, sustain: 0 },
  }).connect(sweep)
  const tide = new Tone.AutoFilter({ frequency: 0.09, baseFrequency: 180, octaves: 3 }).connect(
    channel(-27)
  )
  const ocean = new Tone.Noise("brown").connect(tide)

  const bar = new Tone.Loop((time) => {
    const step = Tone.Time("16n").toSeconds()
    const at = (n: number) => time + n * step
    const n = count++
    const chord = CHORDS[n % 4]
    const root = ROOTS[n % 4]
    // Eight bars each: headlines, groove, groove with steel drum, breakdown with steel drum.
    const section = Math.floor(n / 8) % 4
    const drums = section === 1 || section === 2

    pad.triggerAttackRelease(chord, "1m", time, 0.6)
    for (let i = 0; i < 8; i++) {
      const note = i % 2 ? Tone.Frequency(root).transpose(12).toNote() : root
      bass.triggerAttackRelease(note, "16n", at(i * 2), i % 4 === 0 ? 0.9 : 0.65)
    }
    if (section !== 3) {
      for (let i = 0; i < 16; i++) {
        const note = Tone.Frequency(chord[(i * 2) % chord.length]).transpose(i % 8 > 4 ? 24 : 12)
        arp.triggerAttackRelease(note.toNote(), "32n", at(i), i % 4 === 0 ? 0.7 : 0.4)
      }
    }
    for (const s of CLAVE[n % 2]) clave.triggerAttackRelease("D#6", "32n", at(s), 0.7)
    for (const s of CONGA_HIGH) congaHigh.triggerAttackRelease("A3", "16n", at(s), 0.6)
    for (const s of CONGA_LOW) congaLow.triggerAttackRelease("D3", "16n", at(s), s % 2 ? 0.8 : 0.6)
    if (section === 0) {
      for (let i = 0; i < 16; i++)
        if ((i * 7 + n) % 5 !== 0) teletype.triggerAttackRelease("A6", "64n", at(i), 0.5)
    }
    if (drums) {
      for (const s of KICK) kick.triggerAttackRelease("C1", "8n", at(s), 0.9)
      for (const s of SNARE) snare.triggerAttackRelease("16n", at(s), 0.8)
      for (const s of HAT) hat.triggerAttackRelease("32n", at(s), 0.6)
    }
    if (section >= 2) {
      for (const [b, s, note, length] of MELODY)
        if (b === n % 4) steel.triggerAttackRelease(note, length * step, at(s), 0.7)
    }
    if (n % 8 === 0) {
      timpani.triggerAttackRelease("D2", "2n", at(0), 0.9)
      timpani.triggerAttackRelease("A1", "2n", at(3), 0.7)
      timpani.triggerAttackRelease("D2", "1m", at(6), 1)
    }
  }, "1m")
  let count = 0
  let lastWhoosh = 0

  return {
    /** Once. Everything is then kept silent or audible by play and pause. */
    prepare() {
      Tone.getTransport().bpm.value = BPM
      tide.start()
      ocean.start()
      bar.start(0)
    },
    play(volume: number) {
      Tone.getTransport().start()
      this.volume(volume)
    },
    pause() {
      Tone.getTransport().pause()
      master.volume.rampTo(-60, 0.3)
    },
    /** 0 to 1. */
    volume(v: number) {
      master.volume.rampTo(v <= 0 ? -60 : Tone.gainToDb(v) + 6, 0.2)
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
export async function openScore() {
  await Tone.start()
  return createScore()
}
