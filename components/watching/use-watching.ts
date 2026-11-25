"use client"

import { useEffect, useSyncExternalStore } from "react"
import useSWR from "swr"
import type { Watching } from "@/lib/presence"

/** The main page without a stream open. */
export const HOME_ROOM = "home"

let room = "site"
let me: string | null = null
const listeners = new Set<() => void>()
const tell = () => {
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

type Now = Extract<Watching, { on: true }>

/** The shared count is some seconds old, and whoever is reading it is certainly here. */
export function withMe(now: Now, name: string | null, at: string): Now {
  if (!name) return now
  const was = now.watchers.find((w) => w.name === name)
  // Past the list's limit there is no telling, and one more or less makes no difference.
  if (was?.room === at || (!was && now.total > now.watchers.length)) return now
  const rooms = { ...now.rooms, [at]: (now.rooms[at] ?? 0) + 1 }
  if (was) {
    rooms[was.room] = (rooms[was.room] ?? 1) - 1
    if (rooms[was.room] <= 0) delete rooms[was.room]
  }
  return {
    on: true,
    total: now.total + (was ? 0 : 1),
    rooms,
    watchers: [{ name, room: at }, ...now.watchers.filter((w) => w !== was)],
  }
}

export const setMe = (name: string | null) => {
  if (name === me) return
  me = name
  tell()
}

export const useRoom = () =>
  useSyncExternalStore(
    subscribe,
    () => room,
    () => "site"
  )
export const useMe = () =>
  useSyncExternalStore(
    subscribe,
    () => me,
    () => null
  )

/** What this page is showing: a stream's id, or the main page. */
export function useEnterRoom(next: string) {
  useEffect(() => {
    room = next
    tell()
    return () => {
      room = "site"
      tell()
    }
  }, [next])
}

async function fetcher(url: string): Promise<Watching> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

/** Null until it is known, and while the count is off. */
export function useWatching(often = false) {
  const { data } = useSWR<Watching>("/api/watching", fetcher, {
    refreshInterval: (now) => (now?.on === false ? 0 : often ? 20_000 : 60_000),
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
  const name = useMe()
  const at = useRoom()
  return data?.on ? withMe(data, name, at) : null
}
