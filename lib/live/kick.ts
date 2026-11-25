import { z } from "zod"
import { isLure, isPortStream } from "./filter"
import { appToken, getJson } from "./http"
import type { Channel, SourceResult, Stream } from "./types"

const API = "https://api.kick.com/public"

const Categories = z.object({
  data: z.array(z.object({ id: z.number(), name: z.string() })),
})
const Live = z.object({
  data: z.array(
    z.object({
      title: z.string(),
      viewer_count: z.number(),
      started_at: z.string(),
      channel: z.object({ slug: z.string() }),
      broadcaster_user: z.object({ username: z.string() }),
    })
  ),
})
const Channels = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      stream_title: z.string().nullish(),
      stream: z
        .object({
          is_live: z.boolean(),
          start_time: z.string().nullish(),
          viewer_count: z.number().nullish(),
        })
        .nullish(),
    })
  ),
})

const { KICK_CLIENT_ID: id, KICK_CLIENT_SECRET: secret } = process.env
const token = id && secret ? appToken("https://id.kick.com/oauth/token", id, secret) : null

export async function kick(channels: Channel[]): Promise<SourceResult> {
  if (!token) return { state: "off", streams: [] }
  const headers = { Authorization: `Bearer ${await token()}` }
  const byHandle = new Map(channels.map((c) => [c.handle.toLowerCase(), c]))
  const found = new Map<string, Stream>()
  const add = (
    slug: string,
    s: Pick<Stream, "title" | "startedAt" | "viewers"> & { username?: string }
  ) => {
    const channel = byHandle.get(slug.toLowerCase())
    if (channel ? isLure(s.title) : !isPortStream(s.title)) return
    found.set(slug.toLowerCase(), {
      id: `kick:${slug}`,
      platform: "kick",
      handle: slug,
      name: channel?.name ?? s.username ?? slug,
      title: s.title,
      url: `https://kick.com/${slug}`,
      startedAt: s.startedAt,
      viewers: s.viewers,
      effortId: channel?.effortId ?? null,
      origin: channel ? "tracked" : "search",
      embed: { kind: "kick", slug },
    })
  }

  const categories = await getJson(
    `${API}/v2/categories?${new URLSearchParams({ name: "Grand Theft Auto VI" })}`,
    Categories,
    { revalidate: 86400, headers }
  )
  const game = categories.data.find((c) => /grand theft auto (vi|6)\b/i.test(c.name))
  if (game) {
    const live = await getJson(
      `${API}/v2/livestreams?${new URLSearchParams({ category_id: String(game.id), limit: "1000" })}`,
      Live,
      { revalidate: 60, headers }
    )
    for (const s of live.data) {
      add(s.channel.slug, {
        title: s.title,
        startedAt: s.started_at,
        viewers: s.viewer_count,
        username: s.broadcaster_user.username,
      })
    }
  }

  const slugs = [...byHandle.keys()].slice(0, 50)
  if (slugs.length) {
    const res = await getJson(
      `${API}/v1/channels?${new URLSearchParams(slugs.map((s) => ["slug", s]))}`,
      Channels,
      { revalidate: 60, headers }
    )
    for (const c of res.data) {
      if (!c.stream?.is_live) continue
      add(c.slug, {
        title: c.stream_title ?? "Untitled stream",
        startedAt: c.stream.start_time ?? null,
        viewers: c.stream.viewer_count ?? null,
      })
    }
  }
  return { state: "ok", streams: [...found.values()] }
}
