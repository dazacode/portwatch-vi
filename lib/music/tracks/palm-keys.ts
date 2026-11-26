import * as Tone from "tone"
import { chance, phrase, pick, romans, root, scaleRange, voiced } from "@/lib/music/theory"
import type { Track } from "@/lib/music/track"

// Lo-fi: a jazz progression on electric piano in left-hand voicings, swung dusty drums, a round
// bass, vibraphone fills and the crackle of a record.

const PROGRESSIONS = [
  ["IIm7", "V7", "Imaj7", "VIm7"],
  ["Imaj7", "VIm7", "IIm7", "V7"],
  ["IVmaj7", "IIIm7", "IIm7", "Imaj7"],
  ["IIm7", "V7", "IIIm7", "VIm7"],
]
const COMPING = [[0], [0, 10], [0, 6, 11], [3, 8], [0, 7]]
const PLAN = ["keys", "groove", "vibes", "groove", "vibes", "keys"] as const

export const palmKeys: Track = {
  bpm: 78,
  bars: 48,
  swing: 0.35,
  build({ keep, channel }) {
    const key = pick(["F", "Eb", "Bb", "Db"])
    const chords = romans(key, pick(PROGRESSIONS))
    const keys = voiced(chords, ["E3", "D5"], "lefthand")
    const scale = scaleRange(`${key} major pentatonic`, `${key}4`, `${key}6`)

    const piano = keep(
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 2.2,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { attack: 0.005, decay: 1.4, sustain: 0.25, release: 1.4 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
      })
    ).connect(
      keep(new Tone.Tremolo(3.5, 0.35).start()).connect(
        keep(new Tone.Filter(2800, "lowpass")).connect(channel(-17, ["room"]))
      )
    )
    const bass = keep(
      new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
      })
    ).connect(keep(new Tone.Filter(500, "lowpass")).connect(channel(-10)))
    const vibes = keep(
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 4,
        modulationIndex: 1.5,
        envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 1 },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      })
    ).connect(keep(new Tone.Tremolo(5, 0.4).start()).connect(channel(-22, ["room", "echo"])))
    const kick = keep(
      new Tone.MembraneSynth({ octaves: 3, pitchDecay: 0.03, envelope: { decay: 0.3, sustain: 0 } })
    ).connect(keep(new Tone.Filter(900, "lowpass")).connect(channel(-9)))
    const snare = keep(
      new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.002, decay: 0.12, sustain: 0 },
      })
    ).connect(keep(new Tone.Filter(1800, "bandpass")).connect(channel(-15, ["room"])))
    const hat = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.03, sustain: 0 } })
    ).connect(keep(new Tone.Filter(7000, "highpass")).connect(channel(-27)))
    const crackle = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.0005, decay: 0.004, sustain: 0 } })
    ).connect(keep(new Tone.Filter(2500, "highpass")).connect(channel(-30)))
    keep(new Tone.Noise("pink"))
      .connect(keep(new Tone.Filter(4500, "lowpass")).connect(channel(-46)))
      .start()

    return ({ time, n, at, step }) => {
      const i = n % chords.length
      const part = PLAN[Math.floor(n / 8) % PLAN.length]
      const bar = time + 16 * step

      for (const s of pick(COMPING))
        piano.triggerAttackRelease(keys[i], (16 - s) * step, at(s), 0.5)
      const low = root(chords[i], 2)
      bass.triggerAttackRelease(low, 6 * step, at(0), 0.9)
      bass.triggerAttackRelease(
        Tone.Frequency(low)
          .transpose(pick([7, 12, 5]))
          .toNote(),
        4 * step,
        at(pick([8, 10])),
        0.7
      )
      // The record: clicks at random, in order, because one voice plays them all.
      const clicks = Array.from({ length: 10 }, () => time + Math.random() * (bar - time))
      for (const t of clicks.sort((a, b) => a - b))
        crackle.triggerAttackRelease(0.004, t, Math.random() * 0.7)

      if (part === "keys") return
      for (const s of pick([
        [0, 7, 10],
        [0, 10],
        [0, 3, 10],
      ]))
        kick.triggerAttackRelease("A0", "8n", at(s), 0.9)
      for (const s of [4, 12]) snare.triggerAttackRelease("16n", at(s), 0.75)
      for (let s = 0; s < 16; s += 2)
        if (chance(0.9)) hat.triggerAttackRelease("32n", at(s), 0.3 + Math.random() * 0.3)
      if (part === "vibes" && n % 2 === 0) {
        for (const h of phrase({
          scale,
          chord: keys[i],
          pulses: pick([3, 4, 5]),
          rotate: pick([0, 2]),
        }))
          vibes.triggerAttackRelease(h.note, h.steps * step, at(h.step), 0.6)
      }
    }
  },
}
