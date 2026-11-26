import * as Tone from "tone"
import { answer, phrase, scaleRange } from "@/lib/music/theory"
import type { Track } from "@/lib/music/track"

// The site's first theme: 80s Miami synths, congas, clave and steel drum over a newsroom pulse
// and the ocean. The second time round the steel drum improvises on its own melody.

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
const SCALE = scaleRange("D minor pentatonic", "A4", "A5")

export const newsroomTide: Track = {
  bpm: 108,
  bars: 64,
  build({ keep, channel }) {
    const pad = keep(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
        envelope: { attack: 0.5, decay: 0.4, sustain: 0.7, release: 1.2 },
      })
    ).connect(keep(new Tone.Filter(1100, "lowpass")).connect(channel(-25, ["room"])))
    const bass = keep(
      new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.005, decay: 0.16, sustain: 0.25, release: 0.08 },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.14,
          sustain: 0.2,
          baseFrequency: 140,
          octaves: 2.6,
        },
      })
    ).connect(channel(-13))
    const arp = keep(
      new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.004, decay: 0.1, sustain: 0, release: 0.08 },
      })
    ).connect(keep(new Tone.Filter(2400, "lowpass")).connect(channel(-26, ["echo"])))
    const steel = keep(
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 5,
        envelope: { attack: 0.004, decay: 0.5, sustain: 0.05, release: 0.5 },
        modulationEnvelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.2 },
      })
    ).connect(channel(-17, ["room", "echo"]))
    const kick = keep(new Tone.MembraneSynth({ octaves: 5, pitchDecay: 0.04 })).connect(channel(-9))
    const snare = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.17, sustain: 0 } })
    ).connect(keep(new Tone.Filter(1400, "highpass")).connect(channel(-18, ["room"])))
    const hat = keep(
      new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.045, sustain: 0 } })
    ).connect(keep(new Tone.Filter(8000, "highpass")).connect(channel(-23)))
    const conga = (db: number) =>
      keep(
        new Tone.MembraneSynth({
          octaves: 1.4,
          pitchDecay: 0.012,
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
        })
      ).connect(channel(db, ["room"]))
    const congaHigh = conga(-18)
    const congaLow = conga(-16)
    const clave = keep(
      new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      })
    ).connect(channel(-24, ["room"]))
    const teletype = keep(
      new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 },
      })
    ).connect(channel(-31, ["echo"]))
    const timpani = keep(
      new Tone.MembraneSynth({
        octaves: 2,
        pitchDecay: 0.03,
        envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.6 },
      })
    ).connect(channel(-13, ["room"]))
    const tide = keep(new Tone.AutoFilter({ frequency: 0.09, baseFrequency: 180, octaves: 3 }))
      .connect(channel(-27))
      .start()
    keep(new Tone.Noise("brown")).connect(tide).start()

    let solo = phrase({ scale: SCALE, chord: CHORDS[0], pulses: 5 })

    return ({ time, n, at, step }) => {
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
      for (const s of CONGA_LOW)
        congaLow.triggerAttackRelease("D3", "16n", at(s), s % 2 ? 0.8 : 0.6)
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
        if (n < 32) {
          for (const [b, s, note, length] of MELODY)
            if (b === n % 4) steel.triggerAttackRelease(note, length * step, at(s), 0.7)
        } else {
          // Second time round: a new phrase every two bars, answered in the bar after.
          if (n % 2 === 0) solo = phrase({ scale: SCALE, chord, pulses: 5, rotate: n % 3 })
          const hits = n % 2 ? answer(solo, SCALE) : solo
          for (const h of hits) steel.triggerAttackRelease(h.note, h.steps * step, at(h.step), 0.7)
        }
      }
      if (n % 8 === 0) {
        timpani.triggerAttackRelease("D2", "2n", at(0), 0.9)
        timpani.triggerAttackRelease("A1", "2n", at(3), 0.7)
        timpani.triggerAttackRelease("D2", "1m", at(6), 1)
      }
    }
  },
}
