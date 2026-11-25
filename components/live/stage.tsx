"use client"

import { ExternalLink, Play } from "lucide-react"
import { useState } from "react"
import { Scene } from "@/components/broadcast/scene"
import { Player } from "@/components/live/player"
import { Button, buttonVariants } from "@/components/ui/button"
import { compact, duration, plainTitle } from "@/lib/format"
import { PLATFORM_LABEL, type Stream } from "@/lib/live/types"

/** A stream, full screen. */
export function Stage({
  stream,
  at,
  about,
  autoPlay,
  actions,
}: {
  stream: Stream
  at: string
  about?: string
  autoPlay: boolean
  actions: React.ReactNode
}) {
  // The player loads on request, so no platform is contacted before someone asks to watch.
  const [playing, setPlaying] = useState(autoPlay)
  const platform = PLATFORM_LABEL[stream.platform]
  const facts = [
    platform,
    stream.viewers !== null && `${compact(stream.viewers)} watching`,
    stream.startedAt && `live for ${duration(stream.startedAt, at)}`,
  ].filter(Boolean)

  return (
    <section aria-label="Stream" className="stage-height flex flex-col bg-black text-white">
      <div className="relative isolate flex min-h-0 flex-1">
        {playing && stream.embed ? (
          <div className="absolute inset-0">
            <Player stream={stream} />
          </div>
        ) : (
          <div className="flex w-full flex-col items-start justify-end gap-5 p-4 sm:p-8">
            <div className="absolute inset-0 -z-10">
              <Scene level={60} />
              <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
            </div>
            <h2 className="line-clamp-4 max-w-4xl text-3xl font-extrabold text-balance sm:text-5xl">
              {plainTitle(stream.title)}
            </h2>
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <div className="min-w-0 flex-1 basis-72">
          <p className="font-semibold">{stream.name}</p>
          <p className="text-sm text-white/75">
            {facts.join(", ")}
            {stream.embed && (
              <>
                {". "}
                <a
                  href={stream.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-white"
                >
                  Open there
                </a>
              </>
            )}
            {about ? `. ${about}` : null}
            {stream.origin === "search"
              ? ". Found by its title and not checked by anyone. Don’t install anything it offers."
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </section>
  )
}
