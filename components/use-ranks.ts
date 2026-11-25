"use client"

import { useSyncExternalStore } from "react"
import type { Ranks } from "@/lib/standings"

const KEY = "ranks"
const listeners = new Set<() => void>()
// Kept as well, for browsers that don't allow storage.
let memory: Ranks = "public"

export function getRanks(): Ranks {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved !== null) return saved === "everyone" ? "everyone" : "public"
  } catch {}
  return memory
}

export function setRanks(ranks: Ranks) {
  memory = ranks
  try {
    localStorage.setItem(KEY, ranks)
  } catch {}
  for (const tell of listeners) tell()
}

function subscribe(tell: () => void) {
  listeners.add(tell)
  // The same choice made in another tab.
  window.addEventListener("storage", tell)
  return () => {
    listeners.delete(tell)
    window.removeEventListener("storage", tell)
  }
}

/** Whether private builds are ranked too. One choice for the leaders panel and the standings. */
export const useRanks = () => useSyncExternalStore(subscribe, getRanks, (): Ranks => "public")
