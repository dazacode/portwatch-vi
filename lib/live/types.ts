export const PLATFORMS = ["twitch", "youtube", "kick", "rumble"] as const
export type Platform = (typeof PLATFORMS)[number]

export const PLATFORM_LABEL: Record<Platform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
  rumble: "Rumble",
}

/** An entry in data/channels.json. Handles are stored the way the platform's URL spells them. */
export type Channel = {
  platform: Platform
  handle: string
  name: string
  effortId: string | null
  note?: string
  addedBy: "manual" | "readme"
}

export type Embed =
  | { kind: "twitch"; channel: string }
  | { kind: "youtube"; videoId: string }
  | { kind: "kick"; slug: string }

export type Stream = {
  id: string
  platform: Platform
  handle: string
  name: string
  title: string
  url: string
  startedAt: string | null
  viewers: number | null
  effortId: string | null
  /** "tracked": listed in channels.json. "search": matched by title. */
  origin: "tracked" | "search"
  embed: Embed | null
}

/** off: no API key. error: the platform could not be reached on this check. */
export type SourceState = "ok" | "off" | "error"

/** null: not known, because the platform is off or failed. */
export type ChannelStatus = Channel & { live: boolean | null }

export type Snapshot = {
  at: string
  streams: Stream[]
  channels: ChannelStatus[]
  sources: Record<Platform, SourceState>
}

export type SourceResult = {
  state: SourceState
  streams: Stream[]
  /** Handles whose status could not be read even though the platform as a whole answered. */
  unknown?: string[]
}

export const channelKey = (c: { platform: Platform; handle: string }) =>
  `${c.platform}:${c.handle.toLowerCase()}`
