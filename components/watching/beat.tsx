"use client"

import { useEffect, useRef } from "react"
import { setMe, useRoom, useWatching } from "@/components/watching/use-watching"

const PATH = "/api/watching"

function session() {
  const make = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => (n % 36).toString(36)).join("")
  try {
    const kept = sessionStorage.getItem("watching")
    if (kept) return kept
    const id = make()
    sessionStorage.setItem("watching", id)
    return id
  } catch {
    return make()
  }
}

/** Says this page is being looked at, at a pace the crowd allows, and says so when it no longer is. */
export function WatchingBeat() {
  const room = useRoom()
  const now = useWatching()
  const on = now !== null
  const wait = Math.min(600, Math.max(45, now?.total ?? 0))
  const pace = useRef(wait)
  pace.current = wait
  const id = useRef<string | null>(null)
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!on) return
    id.current ??= session()
    let timer = 0
    const send = async () => {
      window.clearTimeout(timer)
      if (document.visibilityState !== "visible") return
      timer = window.setTimeout(send, pace.current * 1000)
      const left = last.current && last.current !== room ? last.current : undefined
      last.current = room
      try {
        const res = await fetch(PATH, {
          method: "POST",
          body: JSON.stringify({ id: id.current, room, wait: pace.current, left }),
        })
        if (res.ok && res.status === 200) setMe((await res.json()).name)
      } catch {
        // The next one will do.
      }
    }
    const leave = () => {
      window.clearTimeout(timer)
      if (!last.current) return
      navigator.sendBeacon(PATH, JSON.stringify({ id: id.current, room: last.current, gone: true }))
      last.current = null
    }
    const change = () => (document.visibilityState === "visible" ? void send() : leave())
    // Someone passing through a page isn't watching it.
    timer = window.setTimeout(send, 2000)
    document.addEventListener("visibilitychange", change)
    window.addEventListener("pagehide", leave)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", change)
      window.removeEventListener("pagehide", leave)
    }
  }, [on, room])
  return null
}
