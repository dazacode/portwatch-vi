"use client"

import { ArrowUp, ExternalLink, List, Play, Radio, Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { more } from "@/components/broadcast/show"
import { SlideBody } from "@/components/broadcast/slide"
import type { useSound } from "@/components/broadcast/use-sound"
import { Button } from "@/components/ui/button"
import type { Broadcast } from "@/lib/broadcast"
import type { Stream } from "@/lib/live/types"
import { cutsIn, slideTitle } from "@/lib/slides"
import { scrollBehavior } from "@/lib/utils"

/** The slideshow on a phone: one update a screen, swiped through below the countdown. */
export function Feed({
  broadcast,
  streams,
  sound,
  start,
  onPage,
  onWatch,
  onChannels,
  onAll,
}: {
  broadcast: Broadcast
  streams: Stream[]
  sound: ReturnType<typeof useSound>
  /** The page to open on: 0 stays at the countdown. */
  start: number
  /** 0 is the countdown above the feed. */
  onPage: (page: number) => void
  onWatch: (id: string) => void
  onChannels: () => void
  /** Leaves the feed for the page itself. */
  onAll: () => void
}) {
  // Refreshing must not move what is being read, so new slides wait until someone asks for them.
  const [list, setList] = useState(broadcast.slides)
  const [page, setPage] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (page === 0) setList(broadcast.slides)
  }, [page, broadcast.slides])
  const known = new Set(list.map((s) => s.id))
  const waiting = page > 0 && broadcast.slides.some((s) => cutsIn(s) && !known.has(s.id))

  const opensOn = useRef(start)
  useEffect(() => {
    root.current?.children[opensOn.current - 1]?.scrollIntoView({ behavior: "instant" })
  }, [])

  const cue = sound.cue
  // biome-ignore lint/correctness/useExhaustiveDependencies: watched again when the pages change
  useEffect(() => {
    const pages = [...(root.current?.children ?? [])]
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const at = pages.indexOf(entry.target) + 1
          if (entry.isIntersecting) setPage(at)
          // Back up to the countdown.
          else if (at === 1 && entry.boundingClientRect.top > 0) setPage(0)
        }
      },
      { threshold: 0.55 }
    )
    for (const el of pages) watcher.observe(el)
    return () => watcher.disconnect()
  }, [list])

  // biome-ignore lint/correctness/useExhaustiveDependencies: once per page
  useEffect(() => {
    onPage(page)
    const slide = list[page - 1]
    if (!slide) return
    cue(slide.kind === "milestone" ? { kind: "milestone", stars: slide.stars } : { kind: "slide" })
  }, [page])

  return (
    <>
      <div ref={root} role="feed" aria-label="News breakdowns">
        {list.map((slide, i) => {
          const own = streams.find((s) => s.effortId && s.effortId === slide.projectId)
          const watchable =
            slide.kind === "trailer"
              ? slide.stream
              : (own ?? streams.find((s) => s.embed) ?? streams[0])
          const link = more(slide)
          const short = link.external ? "Source" : link.href === "/standings" ? "Table" : "Read"
          return (
            <article
              key={slide.id}
              aria-label={slideTitle(slide)}
              aria-posinset={i + 1}
              aria-setsize={list.length}
              className="feed-page flex min-h-[calc(100svh-var(--promo-h))] items-end gap-3 bg-linear-to-t from-black/85 via-black/45 to-black/10 pt-16 pr-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] pl-4 short:pt-4"
            >
              <div className="min-w-0 flex-1">
                {Math.abs(page - (i + 1)) <= 1 && <SlideBody slide={slide} at={broadcast.at} />}
              </div>
              <div className="flex shrink-0 flex-col items-center gap-3 short:grid short:grid-cols-2">
                {watchable && (
                  <Rail
                    label={slide.kind === "trailer" ? "Trailer" : "Watch"}
                    name={
                      slide.kind === "trailer" ? "Play the trailer" : `Watch ${watchable.name} live`
                    }
                    primary
                    onClick={() => onWatch(watchable.id)}
                  >
                    <Play aria-hidden="true" />
                  </Rail>
                )}
                <a
                  href={link.href}
                  // The word on screen comes first, so it can be said to click it.
                  aria-label={`${short}: ${link.label}`}
                  {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="grid justify-items-center gap-1 text-[0.6875rem] font-medium"
                >
                  <span className="glass grid size-12 place-items-center rounded-full active:bg-white/25">
                    <ExternalLink aria-hidden="true" className="size-5" />
                  </span>
                  <span aria-hidden="true">{short}</span>
                </a>
                <Rail
                  label={`${streams.length} live`}
                  name={`${streams.length} live: all channels`}
                  onClick={onChannels}
                >
                  <Radio aria-hidden="true" />
                </Rail>
                <Rail
                  label="Music"
                  name={sound.on ? "Music: turn off" : "Music: play"}
                  onClick={() => void sound.toggle()}
                >
                  {sound.on ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                </Rail>
                <Rail label="View all" name="View all, without swiping" onClick={onAll}>
                  <List aria-hidden="true" />
                </Rail>
              </div>
            </article>
          )
        })}
      </div>
      {waiting && (
        <div className="fixed inset-x-0 top-[calc(var(--top-gap)+0.25rem)] z-30 flex justify-center">
          <Button
            size="lg"
            onClick={() => {
              setList(broadcast.slides)
              root.current?.scrollIntoView({ behavior: scrollBehavior() })
            }}
          >
            <ArrowUp aria-hidden="true" /> New update
          </Button>
        </div>
      )}
    </>
  )
}

function Rail({
  label,
  name,
  primary = false,
  onClick,
  children,
}: {
  label: string
  name: string
  primary?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={name}
      onClick={onClick}
      className="grid justify-items-center gap-1 text-[0.6875rem] font-medium"
    >
      <span
        className={
          primary
            ? "grid size-12 place-items-center rounded-full bg-primary text-primary-foreground active:bg-primary/80 [&_svg]:size-5"
            : "glass grid size-12 place-items-center rounded-full active:bg-white/25 [&_svg]:size-5"
        }
      >
        {children}
      </span>
      <span aria-hidden="true">{label}</span>
    </button>
  )
}
