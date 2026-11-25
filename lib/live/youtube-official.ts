import { z } from "zod"
import { isLure, isPortStream } from "./filter"
import { getJson, getText } from "./http"
import type { Channel, SourceResult, Stream } from "./types"

// Fallback for lib/live/youtube.ts, used only when YOUTUBE_API_KEY is set.
const API = "https://www.googleapis.com/youtube/v3"
const QUERY = "gta 6 recomp|gta vi recompilation|gta 6 pc port"
// search.list has its own quota of 100 calls a day. Every 30 minutes is 48.
const SEARCH_EVERY = 1800

const Search = z.object({
  items: z.array(z.object({ id: z.object({ videoId: z.string() }) })),
})
const ChannelIds = z.object({
  items: z.array(z.object({ id: z.string() })).optional(),
})
const Videos = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({
        title: z.string(),
        channelId: z.string(),
        channelTitle: z.string(),
        liveBroadcastContent: z.string(),
      }),
      liveStreamingDetails: z
        .object({
          actualStartTime: z.string().optional(),
          concurrentViewers: z.string().optional(),
        })
        .optional(),
    })
  ),
})

const key = process.env.YOUTUBE_API_KEY

/** Handles are "@name" or a "UC…" channel id. */
async function channelId(handle: string) {
  if (handle.startsWith("UC")) return handle
  const query = new URLSearchParams({ part: "id", forHandle: handle, key: key ?? "" })
  const res = await getJson(`${API}/channels?${query}`, ChannelIds, { revalidate: 86400 })
  return res.items?.[0]?.id ?? null
}

/** The channel's newest videos from its public feed, which costs no quota. */
async function recentVideoIds(id: string) {
  const xml = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, {
    revalidate: 120,
  })
  return [...xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].slice(0, 3).map((m) => m[1])
}

export async function youtubeOfficial(channels: Channel[]): Promise<SourceResult> {
  if (!key) return { state: "off", streams: [] }

  const byId = new Map<string, Channel>()
  const unknown: string[] = []
  const ids = new Set<string>()
  await Promise.all(
    channels.map(async (c) => {
      try {
        const id = await channelId(c.handle)
        if (!id) throw new Error("No such channel")
        byId.set(id, c)
        for (const video of await recentVideoIds(id)) ids.add(video)
      } catch {
        unknown.push(c.handle)
      }
    })
  )

  const query = new URLSearchParams({
    part: "id",
    type: "video",
    eventType: "live",
    maxResults: "25",
    q: QUERY,
    key,
  })
  // Out of search quota only costs discovery; tracked channels still resolve.
  const search = await getJson(`${API}/search?${query}`, Search, {
    revalidate: SEARCH_EVERY,
  }).catch(() => null)
  for (const item of search?.items ?? []) ids.add(item.id.videoId)

  const all = [...ids].sort()
  const streams: Stream[] = []
  for (let i = 0; i < all.length; i += 50) {
    const batch = new URLSearchParams({
      part: "snippet,liveStreamingDetails",
      id: all.slice(i, i + 50).join(","),
      key,
    })
    const res = await getJson(`${API}/videos?${batch}`, Videos, { revalidate: 60 })
    for (const v of res.items) {
      if (v.snippet.liveBroadcastContent !== "live") continue
      const channel = byId.get(v.snippet.channelId)
      if (channel ? isLure(v.snippet.title) : !isPortStream(v.snippet.title)) continue
      const viewers = v.liveStreamingDetails?.concurrentViewers
      streams.push({
        id: `youtube:${v.id}`,
        platform: "youtube",
        handle: channel?.handle ?? v.snippet.channelId,
        name: channel?.name ?? v.snippet.channelTitle,
        title: v.snippet.title,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        startedAt: v.liveStreamingDetails?.actualStartTime ?? null,
        viewers: viewers ? Number(viewers) : null,
        effortId: channel?.effortId ?? null,
        origin: channel ? "tracked" : "search",
        embed: { kind: "youtube", videoId: v.id },
      })
    }
  }
  // A rejected key or spent quota fails every call, and must not read as "nobody is live".
  const reachable = search !== null || byId.size > 0
  return { state: reachable ? "ok" : "error", streams, unknown }
}
