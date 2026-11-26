import * as Tone from "tone"
import {
  answer,
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

// A chase: four on the floor, a rolling Phrygian bass, stabs on a Euclidean rhythm, a riser into
// every new section and a lead that writes its own motif.

const PROGRESSIONS = [
  ["Im", "bII", "Im", "bVII"],
  ["Im", "bVI", "bII", "Im"],
  ["Im", "Im", "bII", "bIII"],
]
const PLAN = ["intro", "drive", "stabs", "lead", "break", "drive", "lead", "lead"] as const

export const midnightPursuit: Track = {
  bpm: 124,
  bars: 64,
  build({ keep, channel }) {
    const key = pick(["E", "F", "C#"])
    const chords = romans(key, pick(PROGRESSIONS))
    const stabs = voiced(chords, ["E4", "E5"], "triads")
    const scale = scaleRange(`${key} phrygian`, `${key}4`, `${key}6`)
    const stabRhythm = euclid(16, pick([5, 7]), pick([0, 2]))

    const kick = keep(new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.03 })).connect(channel(-7))
    const clap = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.14, sustain: 0 } })
    ).connect(keep(new Tone.Filter(1500, "bandpass")).connect(channel(-15, ["room"])))
    const open = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.12, sustain: 0 } })
    ).connect(keep(new Tone.Filter(7500, "highpass")).connect(channel(-25)))
    const closed = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.025, sustain: 0 } })
    ).connect(keep(new Tone.Filter(9000, "highpass")).connect(channel(-30)))
    const bass = keep(
      new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.003, decay: 0.1, sustain: 0.2, release: 0.05 },
        filterEnvelope: {
          attack: 0.003,
          decay: 0.09,
          sustain: 0.1,
          baseFrequency: 120,
          octaves: 3.2,
        },
      })
    ).connect(channel(-14))
    const stab = keep(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsquare", count: 2, spread: 20 },
        envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.1 },
      })
    ).connect(keep(new Tone.Filter(2000, "lowpass")).connect(channel(-24, ["echo"])))
    const lead = keep(
      new Tone.MonoSynth({
        portamento: 0.03,
        oscillator: { type: "fatsawtooth", count: 3, spread: 16 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.4,
          baseFrequency: 900,
          octaves: 2.5,
        },
      })
    ).connect(channel(-23, ["room", "echo"]))
    const sweep = keep(new Tone.Filter(200, "bandpass")).connect(channel(-24, ["room"]))
    const riser = keep(
      new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 2, decay: 0.1, sustain: 1, release: 0.1 },
      })
    ).connect(sweep)
    const crash = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 1.6, sustain: 0 } })
    ).connect(keep(new Tone.Filter(4000, "highpass")).connect(channel(-26, ["room"])))

    let motif: Hit[] = []
    return ({ time, n, at, step }) => {
      const i = n % chords.length
      const part = PLAN[Math.floor(n / 8) % PLAN.length]
      const bar = 16 * step
      if (n % 8 === 0 && n > 0) crash.triggerAttackRelease("1m", time, 0.7)
      if (n % 8 === 7) {
        sweep.frequency.cancelScheduledValues(time)
        sweep.frequency.setValueAtTime(200, time)
        sweep.frequency.exponentialRampToValueAtTime(7000, time + bar)
        riser.triggerAttackRelease(bar * 0.98, time, 0.6)
      }

      // The rolling bass: every sixteenth the kick leaves free, the flat second as a sting.
      const low = root(chords[i], 1)
      const flat2 = Tone.Frequency(low).transpose(1).toNote()
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 0) continue
        const note =
          s === 7 || s === 15 ? Tone.Frequency(low).transpose(12).toNote() : s === 14 ? flat2 : low
        bass.triggerAttackRelease(note, "32n", at(s), s % 4 === 2 ? 0.85 : 0.6)
      }
      for (let s = 0; s < 16; s++) closed.triggerAttackRelease("32n", at(s), s % 2 ? 0.35 : 0.55)
      if (part === "intro" || part === "break") return

      for (const s of [0, 4, 8, 12]) kick.triggerAttackRelease("C1", "8n", at(s), 0.95)
      for (const s of [4, 12]) clap.triggerAttackRelease("16n", at(s), 0.8)
      for (const s of [2, 6, 10, 14]) open.triggerAttackRelease("16n", at(s), 0.55)
      if (part === "stabs" || part === "lead")
        for (const s of stabRhythm) stab.triggerAttackRelease(stabs[i], "16n", at(s), 0.6)
      if (part === "lead") {
        if (n % 4 === 0) motif = phrase({ scale, chord: stabs[i], pulses: pick([6, 7, 9]) })
        const hits = n % 2 ? answer(motif, scale) : motif
        for (const h of hits) lead.triggerAttackRelease(h.note, h.steps * step, at(h.step), 0.75)
      }
    }
  },
}
