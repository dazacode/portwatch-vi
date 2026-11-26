import * as Tone from "tone"
import {
  answer,
  arpeggio,
  freshProgression,
  type Hit,
  phrase,
  pick,
  root,
  scaleRange,
  voiced,
} from "@/lib/music/theory"
import type { Track } from "@/lib/music/track"

// Night-drive synthwave: wide saw pads, a sixteenth arpeggio through the echo, gated snare and a
// lead that writes its own hook. The chords are new every time it starts.

const PLAN = ["intro", "groove", "lead", "lead", "break", "groove", "lead", "lead"] as const

export const neonCauseway: Track = {
  bpm: 96,
  bars: 64,
  build({ keep, channel }) {
    const tonic = pick(["A", "E", "F#"])
    const chords = freshProgression(tonic, "minor")
    const pads = voiced(chords, ["E3", "E4"], "triads")
    const arps = arpeggio(chords, 4, 4, pick(["0123", "0121", "0213"]))
    const scale = scaleRange(`${tonic} minor pentatonic`, `${tonic}4`, `${tonic}6`)

    const pad = keep(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 32 },
        envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 2 },
      })
    ).connect(keep(new Tone.Filter(900, "lowpass")).connect(channel(-24, ["room"])))
    const bass = keep(
      new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.004, decay: 0.2, sustain: 0.4, release: 0.1 },
        filterEnvelope: {
          attack: 0.004,
          decay: 0.18,
          sustain: 0.3,
          baseFrequency: 110,
          octaves: 3,
        },
      })
    ).connect(channel(-14))
    const arp = keep(
      new Tone.Synth({
        oscillator: { type: "pulse", width: 0.3 },
        envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.08 },
      })
    ).connect(keep(new Tone.Filter(2200, "lowpass")).connect(channel(-27, ["echo"])))
    const lead = keep(
      new Tone.MonoSynth({
        portamento: 0.04,
        oscillator: { type: "fatsquare", count: 2, spread: 12 },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.3 },
        filterEnvelope: {
          attack: 0.02,
          decay: 0.4,
          sustain: 0.5,
          baseFrequency: 700,
          octaves: 2.5,
        },
      })
    ).connect(keep(new Tone.Vibrato(5, 0.08)).connect(channel(-22, ["room", "echo"])))
    const kick = keep(new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.05 })).connect(channel(-8))
    // A big room cut short: the gated snare.
    const gate = keep(new Tone.Gate(-38, 0.05)).connect(channel(-15))
    const hall = keep(new Tone.Reverb({ decay: 1.2, wet: 0.55 })).connect(gate)
    const snare = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.22, sustain: 0 } })
    ).connect(keep(new Tone.Filter(900, "highpass")).connect(hall))
    const hat = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.035, sustain: 0 } })
    ).connect(keep(new Tone.Filter(9000, "highpass")).connect(channel(-26)))

    let hook: Hit[] = []
    return ({ time, n, at, step }) => {
      const i = n % chords.length
      const part = PLAN[Math.floor(n / 8) % PLAN.length]
      if (n % 8 === 0) hook = phrase({ scale, chord: pads[0], pulses: pick([5, 6, 7]) })

      pad.triggerAttackRelease(pads[i], "1m", time, 0.55)
      if (part !== "break") {
        for (let s = 0; s < 16; s++)
          arp.triggerAttackRelease(arps[i][s % arps[i].length], "32n", at(s), s % 4 ? 0.45 : 0.7)
      }
      if (part === "intro" || part === "break") return
      const low = root(chords[i], 1)
      for (let s = 0; s < 16; s += 2) {
        const note = s % 4 ? Tone.Frequency(low).transpose(12).toNote() : low
        bass.triggerAttackRelease(note, "16n", at(s), s % 8 ? 0.6 : 0.9)
      }
      for (const s of [0, 4, 8, 12]) kick.triggerAttackRelease("C1", "8n", at(s), 0.95)
      for (const s of [4, 12]) snare.triggerAttackRelease("8n", at(s), 0.85)
      for (let s = 2; s < 16; s += 4) hat.triggerAttackRelease("32n", at(s), 0.6)
      if (part === "lead") {
        const hits = n % 2 ? answer(hook, scale) : hook
        for (const h of hits) lead.triggerAttackRelease(h.note, h.steps * step, at(h.step), 0.8)
      }
    }
  },
}
