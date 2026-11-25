"use client"

import dynamic from "next/dynamic"
import { PLATFORM_LABEL, type Stream } from "@/lib/live/types"

// Only fetched once someone presses play.
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false })

export function Player({ stream }: { stream: Stream }) {
  const title = `${stream.name} on ${PLATFORM_LABEL[stream.platform]}`
  switch (stream.embed?.kind) {
    case "youtube":
    case "twitch":
      return (
        <ReactPlayer
          src={
            stream.embed.kind === "youtube"
              ? `https://www.youtube-nocookie.com/embed/${stream.embed.videoId}`
              : `https://www.twitch.tv/${stream.embed.channel}`
          }
          title={title}
          width="100%"
          height="100%"
          playing
          controls
          playsInline
        />
      )
    case "kick":
      // react-player has no Kick support.
      return (
        <iframe
          title={title}
          src={`https://player.kick.com/${stream.embed.slug}?autoplay=true`}
          className="size-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )
    default:
      return null
  }
}
