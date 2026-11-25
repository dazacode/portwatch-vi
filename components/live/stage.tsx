"use client"

import { ExternalLink, Play } from "lucide-react"
import { useState } from "react"
import { Player } from "@/components/live/player"
import { Sunset } from "@/components/sunset"
import { Button, buttonVariants } from "@/components/ui/button"
import { compact, duration, plainTitle } from "@/lib/format"
import { PLATFORM_LABEL, type Stream } from "@/lib/live/types"
import { cn } from "@/lib/utils"

function Backdrop() {
  return (
    <div className="absolute inset-0 -z-10">
      <Sunset className="size-full" />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 via-45% to-transparent" />
    </div>
  )
}

export function Stage({
  stream,
  at,
  about,
}: {
  stream: Stream | null
  at: string
  about?: string
}) {
  // The player loads on request, so no platform is contacted before someone asks to watch.
  const [playing, setPlaying] = useState(false)

  if (!stream) {
    return (
      <section
        aria-label="Stream"
        className="relative isolate flex min-h-56 flex-col justify-end overflow-hidden p-5 text-white sm:p-8 lg:aspect-video"
      >
        <Backdrop />
        <p className="text-lg font-medium">Nobody is live right now</p>
        <p className="mt-1 max-w-md text-sm text-white/85">
          This page checks every minute while it’s open. A stream shows up here as soon as it
          starts.
        </p>
      </section>
    )
  }

  const platform = PLATFORM_LABEL[stream.platform]
  const facts = [
    platform,
    stream.viewers !== null && `${compact(stream.viewers)} watching`,
    stream.startedAt && `live for ${duration(stream.startedAt, at)}`,
  ].filter(Boolean)

  return (
    <section aria-label="Stream" className="min-w-0">
      <div
        className={cn(
          "relative isolate flex overflow-hidden bg-black text-white",
          stream.embed ? "aspect-video" : "min-h-56 lg:aspect-video"
        )}
      >
        {playing && stream.embed ? (
          <Player stream={stream} />
        ) : (
          <div className="flex w-full flex-col items-start justify-end gap-4 p-5 sm:p-8">
            <Backdrop />
            <p className="line-clamp-3 max-w-2xl text-xl font-medium text-balance sm:text-3xl">
              {plainTitle(stream.title)}
            </p>
            {stream.embed ? (
              <Button size="lg" onClick={() => setPlaying(true)}>
                <Play /> Play
              </Button>
            ) : (
              <a
                href={stream.url}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "lg" })}
              >
                Watch on {platform} <ExternalLink />
              </a>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-lg font-semibold">{stream.name}</h1>
        <p className="text-sm text-muted-foreground">
          {facts.join(", ")}
          {stream.embed && (
            <>
              {". "}
              <a
                href={stream.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Open there
              </a>
            </>
          )}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {about ? `${about}. ` : null}
        {stream.origin === "search"
          ? "Found by its title and not checked by anyone. Don’t install anything it offers."
          : null}
      </p>
    </section>
  )
}
