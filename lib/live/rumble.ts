import { z } from "zod"
import { isLure } from "./filter"
import { getText } from "./http"
import type { Channel, SourceResult, Stream } from "./types"

// Rumble has no public API for other people's channels, so this reads the public channel page,
// which its robots.txt allows (only /api/ and /l/ are off limits). It stays slow and small on
// purpose, and it never retries or works around a block: a failure is shown as "not known".
const CHECK_EVERY = 180
const MAX_CHANNELS = 12

const decode = (s: string) =>
  s
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim()

// The page carries its video list as JSON. Other kinds of item can sit in it, so each is read alone.
const Grid = z.object({ items: z.array(z.unknown()) })
const Live = z.object({
  title: z.string().min(1),
  relative_url: z.string().regex(/^\/v/),
  live: z.literal(true),
  live_placeholder: z.literal(false).optional(),
})

function grid(html: string) {
  const raw = html.match(
    /<rum-videos-grid[^>]*>\s*<script type="application\/json">([\s\S]*?)<\/script>/
  )?.[1]
  if (!raw) return undefined
  try {
    return Grid.safeParse(JSON.parse(raw)).data?.items
  } catch {
    return undefined
  }
}

/**
 * The live stream on a channel page: null when offline, undefined when the page has no video list to
 * read, so a bot challenge or a new page layout shows as "not known" and not as offline.
 */
export function parseRumble(html: string): { title: string; path: string } | null | undefined {
  const items = grid(html)
  if (!items) return undefined
  for (const item of items) {
    const live = Live.safeParse(item).data
    if (live) return { title: decode(live.title), path: live.relative_url.replace(/[?#].*$/, "") }
  }
  return null
}

export async function rumble(channels: Channel[]): Promise<SourceResult> {
  const streams: Stream[] = []
  const unknown = channels.slice(MAX_CHANNELS).map((c) => c.handle)
  const checked = channels.slice(0, MAX_CHANNELS)
  await Promise.all(
    checked.map(async (c) => {
      try {
        const live = parseRumble(
          await getText(`https://rumble.com/${c.handle}`, { revalidate: CHECK_EVERY })
        )
        if (live === undefined) throw new Error("Not a channel page")
        if (!live || isLure(live.title)) return
        streams.push({
          id: `rumble:${c.handle}`,
          platform: "rumble",
          handle: c.handle,
          name: c.name,
          title: live.title,
          url: `https://rumble.com${live.path}`,
          startedAt: null,
          viewers: null,
          effortId: c.effortId,
          origin: "tracked",
          embed: null,
        })
      } catch {
        unknown.push(c.handle)
      }
    })
  )
  const allFailed = checked.length > 0 && unknown.length === channels.length
  return { state: allFailed ? "error" : "ok", streams, unknown }
}
