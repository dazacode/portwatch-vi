"use client"

import { useEffect, useState } from "react"

export function useFullscreen() {
  const [full, setFull] = useState(false)
  // iPhones only let a video go full screen, not a page.
  const [can, setCan] = useState(true)
  useEffect(() => {
    const sync = () => {
      const on = document.fullscreenElement !== null
      setFull(on)
      document.documentElement.classList.toggle("tv", on)
    }
    setCan(document.fullscreenEnabled === true)
    sync()
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])
  const toggle = () => {
    // The whole document goes full screen, so drawers and menus still appear on top.
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }
  return { full, can, toggle }
}
