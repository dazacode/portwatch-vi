import { parseWatching } from "./watching"

export type Found = {
  videoId: string
  title: string
  channelId: string
  channelName: string
  viewers: number | null
}

type Text = { toString(): string; endpoint?: { payload?: { browseId?: string } } }

/** What is read of youtubei.js's LockupView. */
export type Lockup = {
  content_id?: string
  content_image?: { overlays?: unknown } | null
  metadata?: {
    title?: Text
    image?: {
      renderer_context?: {
        command_context?: { on_tap?: { payload?: { browseId?: string } } }
      }
    } | null
    metadata?: {
      metadata_rows: {
        metadata_parts?: { text: Text | null; avatar_stack: { text?: Text } | null }[]
      }[]
    } | null
  } | null
}

/**
 * A live search result in YouTube's newer layout. It answers with this or the older one, seemingly at
 * random. Null if it isn't live, or doesn't say whose it is.
 */
export function fromLockup(node: Lockup): Found | null {
  const { content_id: videoId, metadata } = node
  if (!videoId || !metadata) return null
  const overlays = JSON.stringify(node.content_image?.overlays ?? "")
  if (!overlays.includes("THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE")) return null
  // The first row is the channel and the viewers. Later ones are the description, which can say anything.
  const parts = metadata.metadata?.metadata_rows[0]?.metadata_parts ?? []
  const owner = parts.find((p) => p.avatar_stack)?.avatar_stack?.text ?? parts[0]?.text
  const channelId =
    metadata.image?.renderer_context?.command_context?.on_tap?.payload?.browseId ??
    owner?.endpoint?.payload?.browseId
  if (!channelId) return null
  const viewers = parts.map((p) => parseWatching(p.text?.toString())).find((n) => n !== null)
  return {
    videoId,
    title: metadata.title?.toString() ?? "Untitled stream",
    channelId,
    channelName: owner?.toString().trim() || channelId,
    viewers: viewers ?? null,
  }
}
