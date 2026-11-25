"use client"

import { useEffect, useSyncExternalStore } from "react"

/** The main page without a stream open. */
export const HOME_ROOM = "home"

/** A socket that sends the count. Without one there is none, and nothing is asked. */
const URL = process.env.NEXT_PUBLIC_WATCHING_URL

export type Watching = {
  total: number
  rooms: Record<string, number>
  watchers: { name: string; room: string }[]
}

const state: { now: Watching | null; me: string | null } = { now: null, me: null }
let room = "site"
let socket: WebSocket | null = null
let users = 0
let failures = 0
let retry = 0
let hidden = 0
const listeners = new Set<() => void>()
const tell = () => {
  for (const l of listeners) l()
}

/** Null for anything but a count. */
export function parseWatching(text: unknown): Watching | null {
  try {
    const data = JSON.parse(String(text))
    return Number.isInteger(data.total) && data.rooms && Array.isArray(data.watchers) ? data : null
  } catch {
    return null
  }
}

function send() {
  if (socket?.readyState === WebSocket.OPEN) socket.send(room)
}

function drop() {
  socket = null
  state.now = null
  state.me = null
  tell()
}

function connect() {
  window.clearTimeout(retry)
  if (!URL || socket || users === 0 || document.visibilityState !== "visible") return
  const ws = new WebSocket(URL)
  socket = ws
  ws.onopen = () => send()
  ws.onmessage = ({ data }) => {
    const now = parseWatching(data)
    if (now) {
      failures = 0
      state.now = now
    } else {
      try {
        state.me = JSON.parse(String(data)).me ?? state.me
      } catch {}
    }
    tell()
  }
  ws.onclose = () => {
    if (socket !== ws) return
    drop()
    // Full or down: ask less and less, then leave it for this visit.
    failures += 1
    if (failures <= 5)
      retry = window.setTimeout(connect, 5000 * 3 ** (failures - 1) * (0.5 + Math.random()))
  }
}

function disconnect() {
  window.clearTimeout(retry)
  const ws = socket
  drop()
  ws?.close()
}

function change() {
  window.clearTimeout(hidden)
  if (document.visibilityState === "visible") connect()
  else hidden = window.setTimeout(disconnect, 5 * 60_000)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  users += 1
  if (users === 1) {
    // Someone passing through isn't watching.
    retry = window.setTimeout(connect, 2000)
    document.addEventListener("visibilitychange", change)
  }
  return () => {
    listeners.delete(listener)
    users -= 1
    if (users > 0) return
    document.removeEventListener("visibilitychange", change)
    window.clearTimeout(hidden)
    disconnect()
  }
}

/** Null until it is known, and while there is no count. */
export const useWatching = () =>
  useSyncExternalStore(
    subscribe,
    () => state.now,
    () => null
  )
export const useMe = () =>
  useSyncExternalStore(
    subscribe,
    () => state.me,
    () => null
  )

/** What this page is showing: a stream's id, or the main page. */
export function useEnterRoom(next: string) {
  useEffect(() => {
    room = next
    send()
    return () => {
      room = "site"
      send()
    }
  }, [next])
}
