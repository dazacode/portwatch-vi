import { unstable_cache } from "next/cache"
import { Innertube, YTNodes } from "youtubei.js"
import { isLure, isPortStream } from "./filter"
import type { Channel, SourceResult, Stream } from "./types"
import { parseWatching } from "./watching"
import { youtubeOfficial } from "./youtube-official"

// youtubei.js reads what youtube.com itself reads: no key and no daily quota. Only listings are
// read, never video. YouTube blocks some datacenter addresses; nothing here works around that.
// When it happens the official API takes over if YOUTUBE_API_KEY is set.
const QUERIES = ["gta 6 recomp", "gta vi recompilation", "gta 6 pc port"]
const CHECK_EVERY = 120

type Found = {
  videoId: string
  title: string
  channelId: string
  channelName: string
  viewers: number | null
}

let session: Promise<Innertube> | null = null
function client() {
  session ??= Innertube.create({ retrieve_player: false }).catch((err) => {
    session = null
    throw err
  })
  return session
}

const searchLive = unstable_cache(
  async (query: string): Promise<Found[]> => {
    const results = await (await client()).search(query, { type: "video", features: ["live"] })
    return results.videos.flatMap((node) => {
      const video = node.as(YTNodes.Video)
      if (!video.is_live) return []
      return {
        videoId: video.video_id,
        title: video.title.toString(),
        channelId: video.author.id,
        channelName: video.author.name.trim(),
        viewers: parseWatching(video.view_count?.toString()),
      }
    })
  },
  ["youtube-search"],
  { revalidate: CHECK_EVERY }
)

const channelId = unstable_cache(
  async (handle: string): Promise<string> => {
    if (handle.startsWith("UC")) return handle
    const { payload } = await (await client()).resolveURL(`https://www.youtube.com/${handle}`)
    return payload.browseId
  },
  ["youtube-channel-id"],
  { revalidate: 86400 }
)

const channelLive = unstable_cache(
  async (id: string, name: string): Promise<Found[]> => {
    const channel = await (await client()).getChannel(id)
    if (!channel.has_live_streams) return []
    const { videos } = await channel.getLiveStreams()
    return videos.flatMap((node) => {
      if (!node.is(YTNodes.LockupView) || !node.content_id) return []
      const badges = node.content_image?.is(YTNodes.ThumbnailView)
        ? JSON.stringify(node.content_image.overlays)
        : ""
      if (!badges.includes("THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE")) return []
      return {
        videoId: node.content_id,
        title: node.metadata?.title?.toString() ?? "Untitled stream",
        channelId: id,
        channelName: name,
        viewers: parseWatching(JSON.stringify(node.metadata?.metadata ?? "")),
      }
    })
  },
  ["youtube-channel-live"],
  { revalidate: CHECK_EVERY }
)

async function keyless(channels: Channel[]): Promise<SourceResult> {
  const byId = new Map<string, Channel>()
  const unknown: string[] = []
  const found = new Map<string, Found>()

  const searches = await Promise.allSettled(QUERIES.map((q) => searchLive(q)))
  for (const s of searches)
    if (s.status === "fulfilled") for (const f of s.value) found.set(f.videoId, f)
  const failed = searches.find((s) => s.status === "rejected")
  if (failed && searches.every((s) => s.status === "rejected")) throw failed.reason

  await Promise.all(
    channels.map(async (c) => {
      try {
        const id = await channelId(c.handle)
        for (const f of await channelLive(id, c.name)) found.set(f.videoId, f)
        byId.set(id, c)
      } catch {
        unknown.push(c.handle)
      }
    })
  )

  const streams: Stream[] = []
  for (const f of found.values()) {
    const channel = byId.get(f.channelId)
    if (channel ? isLure(f.title) : !isPortStream(f.title)) continue
    streams.push({
      id: `youtube:${f.videoId}`,
      platform: "youtube",
      handle: channel?.handle ?? f.channelId,
      name: channel?.name ?? f.channelName,
      title: f.title,
      url: `https://www.youtube.com/watch?v=${f.videoId}`,
      startedAt: null,
      viewers: f.viewers,
      effortId: channel?.effortId ?? null,
      origin: channel ? "tracked" : "search",
      embed: { kind: "youtube", videoId: f.videoId },
    })
  }
  return { state: "ok", streams, unknown }
}

export async function youtube(channels: Channel[]): Promise<SourceResult> {
  try {
    return await keyless(channels)
  } catch (err) {
    const official = await youtubeOfficial(channels)
    if (official.state === "off") throw err
    return official
  }
}
