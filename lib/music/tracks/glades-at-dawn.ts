import * as Tone from "tone"
import { chance, euclid, pick, romans, root, scaleRange, voiced } from "@/lib/music/theory"
import type { Track } from "@/lib/music/track"

// Ambient: slow pads that move one note at a time, bells on Euclidean rhythms that never quite
// line up, a low drone, wind and the odd bird.

const PROGRESSIONS = [
  ["Imaj7", "II", "IIIm7", "IVmaj7"],
  ["Imaj7", "VIm7", "IVmaj7", "V"],
  ["IVmaj7", "Imaj7", "VIm7", "II"],
]

export const gladesAtDawn: Track = {
  bpm: 66,
  bars: 32,
  build({ keep, channel }) {
    const key = pick(["D", "E", "C"])
    const chords = romans(key, pick(PROGRESSIONS))
    const pads = voiced(chords, ["D3", "D5"], "all")
    const scale = scaleRange(`${key} major pentatonic`, `${key}5`, `${key}7`)

    const hall = keep(new Tone.Reverb({ decay: 9, wet: 0.7 })).connect(channel(-6))
    const pad = keep(
      new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        envelope: { attack: 2.5, decay: 1, sustain: 0.8, release: 4 },
        modulationEnvelope: { attack: 3, decay: 1, sustain: 0.6, release: 4 },
      })
    ).connect(
      keep(new Tone.Chorus(0.3, 4, 0.6).start()).connect(keep(new Tone.Volume(-22)).connect(hall))
    )
    const bells = keep(
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 9,
        envelope: { attack: 0.002, decay: 2.2, sustain: 0, release: 2 },
        modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.6 },
      })
    ).connect(keep(new Tone.Volume(-26)).connect(hall))
    bells.connect(channel(-34, ["echo"]))
    const drone = keep(
      new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 3, decay: 0, sustain: 1, release: 4 },
      })
    ).connect(channel(-20))
    const bird = keep(
      new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0.02 },
      })
    ).connect(keep(new Tone.Volume(-30)).connect(hall))
    const wind = keep(new Tone.AutoFilter({ frequency: 0.05, baseFrequency: 300, octaves: 3 }))
      .connect(channel(-32))
      .start()
    keep(new Tone.Noise("pink")).connect(wind).start()

    return ({ time, n, at, step }) => {
      // Each chord holds for two bars.
      const i = Math.floor(n / 2) % chords.length
      if (n % 2 === 0) {
        pad.triggerAttackRelease(pads[i], "2m", time, 0.5)
        drone.triggerAttackRelease(root(chords[i], 2), "2m", time, 0.7)
      }
      if (n >= 2) {
        // Two bell voices with different pulse counts drift against each other.
        for (const [pulses, offset] of [
          [pick([2, 3]), 0],
          [pick([3, 5]), pick([1, 3])],
        ])
          for (const s of euclid(16, pulses, offset))
            if (chance(0.75))
              bells.triggerAttackRelease(pick(scale), "2n", at(s), 0.3 + Math.random() * 0.4)
      }
      if (chance(0.3)) {
        const start = at(pick([1, 5, 9, 13]))
        const f = 2600 + Math.random() * 1400
        for (let k = 0; k < pick([2, 3, 4]); k++) {
          const t = start + k * step * 0.6
          bird.triggerAttackRelease(f, 0.06, t, 0.5)
          bird.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.06)
        }
      }
    }
  },
}
