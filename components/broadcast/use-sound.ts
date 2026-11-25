"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Cue, Score } from "@/lib/sound"

const KEY = "volume"

/** Music and cues. Nothing is downloaded until the first time sound is turned on. */
export function useSound(active: boolean) {
  const score = useRef<Score | null>(null)
  const [on, setOn] = useState(false)
  const [volume, setVolumeState] = useState(0.7)

  useEffect(() => {
    const saved = Number.parseFloat(localStorage.getItem(KEY) ?? "")
    if (saved >= 0 && saved <= 1) setVolumeState(saved)
  }, [])

  const toggle = useCallback(async () => {
    if (on) {
      setOn(false)
      return
    }
    if (!score.current) {
      const { openScore } = await import("@/lib/sound")
      score.current = await openScore()
      score.current.prepare()
    }
    setOn(true)
  }, [on])

  // A stream has its own sound, so the music stops while one is open.
  const playing = on && active
  const first = useRef(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: volume has its own path below
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (playing) score.current?.play(volume)
    else score.current?.pause()
  }, [playing])
  useEffect(() => () => score.current?.pause(), [])

  const setVolume = useCallback((v: number) => {
    setVolumeState(v)
    localStorage.setItem(KEY, String(v))
    score.current?.volume(v)
  }, [])

  const cue = useCallback((c: Cue) => playing && score.current?.cue(c), [playing])
  return { on, toggle, volume, setVolume, cue }
}
