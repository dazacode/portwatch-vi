import { z } from "zod"
import { isLure, isPortStream } from "./filter"
import { appToken, getJson } from "./http"
import type { Channel, SourceResult, Stream } from "./types"

const API = "https://api.twitch.tv/helix"
// Where port developers stream: the game's own category and Twitch's programming one.
const CATEGORIES = ["Grand Theft Auto VI", "Software and Game Development"]
const PAGES = 3

const Streams = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      user_login: z.string(),
      user_name: z.string(),
      title: z.string(),
      viewer_count: z.number(),
      started_at: z.string(),
    })
  ),
  pagination: z.object({ cursor: z.string().optional() }).optional(),
})
const Games = z.object({ data: z.array(z.object({ id: z.string() })) })

const { TWITCH_CLIENT_ID: id, TWITCH_CLIENT_SECRET: secret } = process.env
const token = id && secret ? appToken("https://id.twitch.tv/oauth2/token", id, secret) : null

export async function twitch(channels: Channel[]): Promise<SourceResult> {
  if (!id || !token) return { state: "off", streams: [] }
  const headers = { "Client-Id": id, Authorization: `Bearer ${await token()}` }
  const helix = (path: string, query: URLSearchParams) =>
    getJson(`${API}/${path}?${query}`, Streams, { revalidate: 60, headers })

  const byHandle = new Map(channels.map((c) => [c.handle.toLowerCase(), c]))
  const found = new Map<string, Stream>()
  const add = (s: z.infer<typeof Streams>["data"][number]) => {
    const channel = byHandle.get(s.user_login.toLowerCase())
    if (channel ? isLure(s.title) : !isPortStream(s.title)) return
    found.set(s.user_login, {
      id: `twitch:${s.user_login}`,
      platform: "twitch",
      handle: s.user_login,
      name: channel?.name ?? s.user_name,
      title: s.title,
      url: `https://www.twitch.tv/${s.user_login}`,
      startedAt: s.started_at,
      viewers: s.viewer_count,
      effortId: channel?.effortId ?? null,
      origin: channel ? "tracked" : "search",
      embed: { kind: "twitch", channel: s.user_login },
    })
  }

  // Search first: a tracked channel's own lookup then overwrites it.
  const games = await getJson(
    `${API}/games?${new URLSearchParams(CATEGORIES.map((n) => ["name", n]))}`,
    Games,
    { revalidate: 86400, headers }
  )
  for (const game of games.data) {
    let cursor: string | undefined
    for (let page = 0; page < PAGES; page++) {
      const query = new URLSearchParams({ game_id: game.id, first: "100" })
      if (cursor) query.set("after", cursor)
      const res = await helix("streams", query)
      res.data.forEach(add)
      cursor = res.pagination?.cursor
      if (!cursor) break
    }
  }

  const handles = [...byHandle.keys()].slice(0, 100)
  if (handles.length) {
    const query = new URLSearchParams(handles.map((h) => ["user_login", h]))
    const res = await helix("streams", query)
    res.data.forEach(add)
  }
  return { state: "ok", streams: [...found.values()] }
}
