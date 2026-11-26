import { Chord, Note } from "tonal"
import { describe, expect, it } from "vitest"
import { PLAYLIST } from "@/lib/music/playlist"
import {
  answer,
  arpeggio,
  chordNotes,
  euclid,
  freshProgression,
  phrase,
  romans,
  scaleRange,
  voiced,
} from "@/lib/music/theory"

describe("the soundtrack's composer", () => {
  it("lists every track once", () => {
    const ids = PLAYLIST.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(6)
  })

  it("writes progressions of real chords, every time", () => {
    for (let k = 0; k < 50; k++) {
      for (const mode of ["major", "minor"] as const) {
        const chords = freshProgression(pick(["A", "E", "F#", "C"]), mode)
        expect(chords).toHaveLength(4)
        for (const c of chords) expect(Chord.get(c).empty, c).toBe(false)
        for (let i = 1; i < chords.length; i++) expect(chords[i]).not.toBe(chords[i - 1])
      }
    }
  })

  it("reads roman numerals in a key", () => {
    expect(romans("G", ["Im", "bVII", "bVI", "V7"])).toEqual(["Gm", "F", "Eb", "D7"])
  })

  it("voices every chord, close to the one before", () => {
    const chords = romans("F", ["IIm7", "V7", "Imaj7", "VIm7"])
    for (const dictionary of ["triads", "lefthand", "all"] as const) {
      const voicings = voiced(chords, ["E3", "D5"], dictionary)
      expect(voicings).toHaveLength(4)
      for (const v of voicings) {
        expect(v.length).toBeGreaterThanOrEqual(3)
        for (const n of v) expect(Note.midi(n)).not.toBeNull()
      }
    }
  })

  it("plays chord notes from an octave", () => {
    expect(chordNotes("Am7", 3)).toEqual(["A3", "C4", "E4", "G4"])
  })

  it("spreads Euclidean hits over the bar", () => {
    expect(euclid(16, 5)).toHaveLength(5)
    expect(euclid(16, 4)).toEqual([0, 4, 8, 12])
    expect(euclid(8, 3, 1)).toEqual([1, 4, 7])
  })

  it("arpeggiates through Scribbletune, and falls back for chords it does not know", () => {
    const [am, g7] = arpeggio(["Am", "G7"], 4, 4)
    expect(am).toEqual(["A4", "C5", "E5", "A5"])
    expect(g7).toHaveLength(4)
    for (const n of g7) expect(Note.midi(n)).not.toBeNull()
  })

  it("writes phrases inside the bar and the scale", () => {
    const scale = scaleRange("D minor pentatonic", "A4", "A5")
    for (let k = 0; k < 50; k++) {
      const hits = phrase({ scale, chord: ["D3", "F3", "A3"], pulses: 5, rotate: k % 3 })
      for (const h of [...hits, ...answer(hits, scale)]) {
        expect(scale).toContain(h.note)
        expect(h.step).toBeGreaterThanOrEqual(0)
        expect(h.step + h.steps).toBeLessThanOrEqual(16)
      }
    }
  })
})

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)] as T
}
