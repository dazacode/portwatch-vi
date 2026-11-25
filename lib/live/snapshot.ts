import { unstable_cache } from "next/cache"
import { getChannels } from "@/lib/tracker"
import { isBoard } from "./filter"
import { kick } from "./kick"
import { rumble } from "./rumble"
import { twitch } from "./twitch"
import {
  type Channel,
  channelKey,
  PLATFORMS,
  type Platform,
  type Snapshot,
  type SourceResult,
  type Stream,
} from "./types"
import { youtube } from "./youtube"

const SOURCES: Record<Platform, (channels: Channel[]) => Promise<SourceResult>> = {
  twitch,
  youtube,
  kick,
  rumble,
}

/** Tracked channels first, then people over 24/7 boards, then by viewers. */
export const byRelevance = (a: Stream, b: Stream) =>
  Number(b.origin === "tracked") - Number(a.origin === "tracked") ||
  Number(isBoard(a.title)) - Number(isBoard(b.title)) ||
  (b.viewers ?? -1) - (a.viewers ?? -1)

export function assemble(
  channels: Channel[],
  results: Record<Platform, SourceResult>,
  at: string
): Snapshot {
  const streams = PLATFORMS.flatMap((p) => results[p].streams).sort(byRelevance)
  const live = new Set(streams.map(channelKey))
  const sources = {} as Snapshot["sources"]
  for (const p of PLATFORMS) sources[p] = results[p].state
  return {
    at,
    streams,
    sources,
    channels: channels.map((c) => {
      const { state, unknown = [] } = results[c.platform]
      const known = state === "ok" && !unknown.includes(c.handle)
      return { ...c, live: live.has(channelKey(c)) ? true : known ? false : null }
    }),
  }
}

/** One platform failing never takes the others down. */
async function takeSnapshot(): Promise<Snapshot> {
  const channels = await getChannels()
  const entries = await Promise.all(
    PLATFORMS.map(async (p): Promise<[Platform, SourceResult]> => {
      try {
        return [p, await SOURCES[p](channels.filter((c) => c.platform === p))]
      } catch (err) {
        console.error(`[live] ${p}:`, err instanceof Error ? err.message : err)
        return [p, { state: "error", streams: [] }]
      }
    })
  )
  return assemble(
    channels,
    Object.fromEntries(entries) as Record<Platform, SourceResult>,
    new Date().toISOString()
  )
}

/** Shared by the page and the API, so the platforms see one check a minute between them. */
export const getSnapshot = unstable_cache(takeSnapshot, ["live-snapshot"], { revalidate: 60 })
