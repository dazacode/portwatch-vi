import type { Stream } from "@/lib/live/types"

// Rockstar's own uploads, played by YouTube's player. Their artwork and footage are never copied here.
const trailer = (videoId: string, title: string): Stream => ({
  id: `trailer:${videoId}`,
  platform: "youtube",
  handle: "@RockstarGames",
  name: "Rockstar Games",
  title,
  url: `https://www.youtube.com/watch?v=${videoId}`,
  startedAt: null,
  viewers: null,
  effortId: null,
  origin: "tracked",
  embed: { kind: "youtube", videoId },
})

export const TRAILERS = [
  trailer("rz1B4B2yBZY", "Grand Theft Auto VI Launch Trailer"),
  trailer("tJbzMqJGH4k", "Grand Theft Auto VI: An Extended Look"),
]
