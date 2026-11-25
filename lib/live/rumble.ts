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

/** The live stream on a channel page: null when offline, undefined when the page isn't a channel page. */
export function parseRumble(html: string): { title: string; path: string } | null | undefined {
  if (!/<title>/.test(html) || !/main-menu/.test(html)) return undefined
  for (const card of html.split(/class="videostream thumbnail__grid--item/).slice(1)) {
    if (!/class="[^"]*\bvideostream__status--live\b/.test(card)) continue
    const title = card.match(/<img\s[^>]*?\balt="([^"]*)"/)?.[1]
    const path = card.match(/class="videostream__link[^>]*?href="(\/v[^"?]+)/)?.[1]
    if (title && path) return { title: decode(title), path }
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
