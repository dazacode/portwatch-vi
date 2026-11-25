"use client"

import { useSyncExternalStore } from "react"
import { HOLIDAY_KEY, HOLIDAYS, type Holiday } from "@/lib/holidays"

const EVENT = "holidaychange"

function subscribe(changed: () => void) {
  window.addEventListener(EVENT, changed)
  return () => window.removeEventListener(EVENT, changed)
}

const read = (key: "season" | "holiday") => () => document.documentElement.dataset[key] ?? null
const season = read("season")
const active = read("holiday")
const nothing = () => null

/** The holiday it is, and whether its theme is on. The script in the layout decides before first paint. */
export function useHoliday() {
  const current = useSyncExternalStore(subscribe, season, nothing)
  const on = useSyncExternalStore(subscribe, active, nothing) !== null
  const holiday: Holiday | null = HOLIDAYS.find((h) => h.id === current) ?? null
  const toggle = () => {
    const { dataset } = document.documentElement
    if (on) delete dataset.holiday
    else if (current) dataset.holiday = current
    try {
      localStorage.setItem(HOLIDAY_KEY, on ? "off" : "on")
    } catch {
      // Without storage it lasts for this page.
    }
    window.dispatchEvent(new Event(EVENT))
  }
  return { holiday, on, toggle }
}
