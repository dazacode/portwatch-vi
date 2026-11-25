"use client"

import { useEffect, useState } from "react"

const EVENTS = ["pointerdown", "touchstart", "wheel", "scroll", "keydown"] as const

/** True once the page has loaded and the browser is idle, or as soon as someone does something. */
export function useIdle() {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (idle) return
    const stop = new AbortController()
    const { signal } = stop
    const ready = () => setIdle(true)
    let wait = 0
    const loaded = () => {
      // Safari has no requestIdleCallback.
      if ("requestIdleCallback" in window) wait = requestIdleCallback(ready, { timeout: 2000 })
      else wait = (window as Window).setTimeout(ready, 300)
    }
    if (document.readyState === "complete") loaded()
    else window.addEventListener("load", loaded, { signal })
    for (const name of EVENTS) window.addEventListener(name, ready, { passive: true, signal })
    return () => {
      stop.abort()
      if ("cancelIdleCallback" in window) cancelIdleCallback(wait)
      else (window as Window).clearTimeout(wait)
    }
  }, [idle])
  return idle
}
