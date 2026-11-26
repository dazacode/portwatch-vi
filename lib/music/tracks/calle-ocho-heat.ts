import * as Tone from "tone"
import {
  answer,
  chordNotes,
  euclid,
  type Hit,
  phrase,
  pick,
  romans,
  root,
  scaleRange,
  voiced,
} from "@/lib/music/theory"
import type { Track } from "@/lib/music/track"

// Little Havana after dark: a dembow beat, a piano montuno on a Euclidean rhythm, a tumbao bass,
// a plucked cuatro melody and horn stabs.

const PROGRESSIONS = [
  ["Im", "bVII", "bVI", "V7"],
  ["Im", "IVm", "bVII", "bIIImaj7"],
  ["Im", "bVI", "bIII", "bVII"],
  ["IVm", "Im", "V7", "Im"],
]
const DEMBOW = [3, 6, 11, 14]
const PLAN = ["intro", "groove", "cuatro", "horns", "groove", "cuatro", "horns", "break"] as const

export const calleOchoHeat: Track = {
  bpm: 98,
  bars: 64,
  build({ keep, channel }) {
    const key = pick(["G", "A", "D"])
    const chords = romans(key, pick(PROGRESSIONS))
    const keys = voiced(chords, ["G3", "G4"], "triads")
    // The raised seventh only over the dominant chord.
    const scaleOf = (chord: string) => {
      const dominant = chord.endsWith("7") && !chord.includes("maj")
      return scaleRange(`${key} ${dominant ? "harmonic minor" : "aeolian"}`, `${key}4`, `${key}5`)
    }
    let scale = scaleOf(chords[0])
    const montuno = euclid(16, pick([7, 9]), pick([0, 1, 3]))

    const piano = keep(
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 1.6,
        envelope: { attack: 0.003, decay: 0.35, sustain: 0.1, release: 0.3 },
        modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.2 },
      })
    ).connect(channel(-21, ["room"]))
    const bass = keep(
      new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.6, release: 0.2 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, baseFrequency: 200, octaves: 2 },
      })
    ).connect(channel(-12))
    const cuatro = keep(
      new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.92 })
    ).connect(channel(-14, ["room", "echo"]))
    const horns = keep(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 14 },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.15 },
      })
    ).connect(keep(new Tone.Filter(2400, "lowpass")).connect(channel(-20, ["room"])))
    const kick = keep(new Tone.MembraneSynth({ octaves: 5, pitchDecay: 0.045 })).connect(
      channel(-10)
    )
    const snare = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.09, sustain: 0 } })
    ).connect(keep(new Tone.Filter(2600, "bandpass")).connect(channel(-14, ["room"])))
    const guiro = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.03, decay: 0.06, sustain: 0 } })
    ).connect(keep(new Tone.Filter(5000, "highpass")).connect(channel(-27)))
    const conga = keep(
      new Tone.MembraneSynth({
        octaves: 1.4,
        pitchDecay: 0.012,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
      })
    ).connect(channel(-16, ["room"]))

    let melody: Hit[] = []
    return ({ n, at, step }) => {
      const i = n % chords.length
      const next = chords[(i + 1) % chords.length]
      const part = PLAN[Math.floor(n / 8) % PLAN.length]

      // Montuno: the chord's top notes on the off-beats, the octave on the downbeat.
      for (const s of montuno)
        piano.triggerAttackRelease(s % 4 ? keys[i].slice(-2) : keys[i], "16n", at(s), 0.55)
      // Tumbao: the bass plays the fifth, then the next chord early.
      const low = root(chords[i], 2)
      if (n % 4 === 0) bass.triggerAttackRelease(low, "8n", at(0), 0.85)
      bass.triggerAttackRelease(Tone.Frequency(low).transpose(7).toNote(), "8n", at(6), 0.75)
      bass.triggerAttackRelease(root(next, 2), "4n", at(12), 0.85)
      for (const [s, note] of [
        [6, "A3"],
        [7, "A3"],
        [14, "D3"],
        [15, "D3"],
      ] as const)
        conga.triggerAttackRelease(note, "16n", at(s), s % 2 ? 0.8 : 0.6)
      if (part === "intro" || part === "break") return

      for (const s of [0, 4, 8, 12]) kick.triggerAttackRelease("C1", "8n", at(s), 0.95)
      for (const s of DEMBOW) snare.triggerAttackRelease("16n", at(s), 0.8)
      for (const s of [0, 2, 4, 6, 8, 10, 12, 14])
        guiro.triggerAttackRelease("16n", at(s), s % 4 ? 0.4 : 0.7)
      if (part === "cuatro") {
        if (n % 4 === 0) scale = scaleOf(chords[i])
        if (n % 4 === 0)
          melody = phrase({ scale, chord: chordNotes(chords[i], 4), pulses: pick([6, 7]) })
        const hits = n % 4 === 3 ? answer(melody, scale) : melody
        for (const h of hits) cuatro.triggerAttackRelease(h.note, h.steps * step, at(h.step), 0.9)
      }
      if (part === "horns" && n % 2 === 1) {
        const stab = chordNotes(chords[i], 4)
        for (const s of [0, 3, 6])
          horns.triggerAttackRelease(stab, s === 6 ? "4n" : "16n", at(s), 0.75)
      }
    }
  },
}
