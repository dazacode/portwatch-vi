import { arp, getChordsByProgression, progression } from "scribbletune/browser"
import { Chord, Note, Progression, RhythmPattern, Scale, Voicing, VoicingDictionary } from "tonal"

// The composing half of the soundtrack. Tonal knows keys, chords, voicings and Euclidean rhythms;
// Scribbletune writes chord progressions and arpeggios. Tone.js (in the tracks) only plays.

export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
export const chance = (p: number) => Math.random() < p
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** A scale's notes between two notes: ("A minor pentatonic", "A4", "A5"). */
export const scaleRange = (name: string, from: string, to: string): string[] =>
  Scale.rangeOf(name)(from, to).filter((n): n is string => Boolean(n))

/** Chord symbols for roman numerals in a key: ("G", ["Im", "bVII"]) gives ["Gm", "F"]. */
export const romans = (tonic: string, degrees: string[]) =>
  Progression.fromRomanNumerals(tonic, degrees)

/** A new progression from Scribbletune's tonic, predominant and dominant rules. */
export function freshProgression(tonic: string, mode: "major" | "minor", count = 4): string[] {
  let degrees = progression(mode, count) as string[]
  // In a minor key Scribbletune's "ii" is a minor chord with a raised sixth; iv sits better.
  if (mode === "minor") degrees = degrees.map((d) => (d === "ii" ? "iv" : d))
  for (let i = 1; i < degrees.length; i++)
    if (degrees[i] === degrees[i - 1]) degrees[i] = mode === "minor" ? "VI" : "vi"
  const named = String(getChordsByProgression(`${tonic}4 ${mode}`, degrees.join(" "))).split(" ")
  // Scribbletune names chords like "FM_4"; tonal reads "F".
  return named.map((c) => c.replace(/_\d+$/, "").replace(/M$/, ""))
}

/** The notes of a chord from an octave: ("Am7", 3) gives ["A3", "C4", "E4", "G4"]. */
export function chordNotes(symbol: string, octave: number): string[] {
  const c = Chord.get(symbol)
  return c.intervals.map((i) => Note.transpose(`${c.tonic}${octave}`, i))
}

export const root = (symbol: string, octave: number) => `${Chord.get(symbol).tonic}${octave}`

/** Each chord voiced close to the one before, as a keyboard player would. */
export function voiced(
  chords: string[],
  range: [string, string],
  dictionary: "triads" | "lefthand" | "all" = "triads"
): string[][] {
  const voicings = Voicing.sequence(chords, range, VoicingDictionary[dictionary])
  return chords.map((c, i) => (voicings[i]?.length ? voicings[i] : chordNotes(c, 3)))
}

/** A Euclidean rhythm as the steps that sound: (16, 5) spreads five hits over sixteen steps. */
export function euclid(steps: number, pulses: number, rotate = 0): number[] {
  const pattern = RhythmPattern.rotate(RhythmPattern.euclid(steps, pulses), rotate)
  return pattern.flatMap((on, i) => (on ? [i] : []))
}

/** Scribbletune's arpeggio for each chord, so many notes per chord, in the given order. */
export function arpeggio(chords: string[], octave: number, count = 4, order?: string): string[][] {
  return chords.map((symbol) => {
    const c = Chord.get(symbol)
    const suffix = symbol.slice(c.tonic?.length ?? 0) || "M"
    try {
      return arp({
        chords: `${c.tonic}${suffix}_${octave}`,
        count,
        ...(order && { order }),
      }) as string[]
    } catch {
      const notes = chordNotes(symbol, octave)
      return Array.from({ length: count }, (_, i) => notes[i % notes.length])
    }
  })
}

export type Hit = { step: number; note: string; steps: number }

/**
 * A one-bar phrase: a Euclidean rhythm, notes stepping through the scale, landing on a chord
 * tone on the strong beats.
 */
export function phrase({
  scale,
  chord,
  pulses,
  rotate = 0,
}: {
  scale: string[]
  chord: string[]
  pulses: number
  rotate?: number
}): Hit[] {
  const on = euclid(16, pulses, rotate)
  const tones = new Set(chord.map((n) => Note.pitchClass(n)))
  let i = Math.floor(scale.length / 2)
  return on.map((step, k) => {
    i = clamp(i + pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]), 0, scale.length - 1)
    if (step % 4 === 0) {
      for (const d of [0, 1, -1, 2, -2]) {
        const j = i + d
        if (scale[j] && tones.has(Note.pitchClass(scale[j]))) {
          i = j
          break
        }
      }
    }
    const next = on[k + 1] ?? 16
    return { step, note: scale[i], steps: Math.max(1, next - step - (chance(0.3) ? 1 : 0)) }
  })
}

/** The same phrase with a new ending: call, then answer. */
export function answer(hits: Hit[], scale: string[]): Hit[] {
  return hits.map((h, k) => {
    if (k < hits.length - 2) return h
    const i = scale.indexOf(h.note)
    if (i < 0) return h
    return { ...h, note: scale[clamp(i + pick([-2, -1, 1, 2]), 0, scale.length - 1)] }
  })
}
