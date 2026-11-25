"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { SlideBody } from "@/components/broadcast/slide"
import { Ticker } from "@/components/broadcast/ticker"
import { Sunset } from "@/components/sunset"
import { Button, buttonVariants } from "@/components/ui/button"
import type { Broadcast, Slide } from "@/lib/broadcast"
import { utcTime } from "@/lib/format"
import type { Stream } from "@/lib/live/types"
import { cn } from "@/lib/utils"

const SECONDS = 9

/** UTC clock. Empty until mounted, so the server and browser agree. */
function Clock() {
  const [now, setNow] = useState("")
  useEffect(() => {
    const tick = () => setNow(utcTime(new Date().toISOString()))
    tick()
    const timer = setInterval(tick, 5000)
    return () => clearInterval(timer)
  }, [])
  return <span>{now}</span>
}

const more = (slide: Slide) =>
  slide.kind === "commit"
    ? { href: slide.commit.url, label: "See the commit", external: true }
    : { href: "/standings", label: "See the standings", external: false }

export function Show({
  broadcast,
  streams,
  onWatch,
}: {
  broadcast: Broadcast
  streams: Stream[]
  onWatch: (id: string) => void
}) {
  const { slides, commits, at } = broadcast
  const [currentId, setCurrentId] = useState(slides[0]?.id)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const seen = useRef(new Set(slides.map((s) => s.id)))

  // A new milestone cuts straight in, like breaking news. Commits arrive too often for that.
  useEffect(() => {
    const fresh = slides.find((s) => s.kind === "milestone" && !seen.current.has(s.id))
    for (const s of slides) seen.current.add(s.id)
    if (fresh) setCurrentId(fresh.id)
  }, [slides])

  // A slide can leave the show while it's on screen; whatever took its place is next.
  const position = useRef(0)
  const found = slides.findIndex((s) => s.id === currentId)
  const index = found >= 0 ? found : Math.min(position.current, slides.length - 1)
  useEffect(() => {
    position.current = index
  }, [index])
  const slide = slides[index]
  if (!slide) return null

  const go = (step: number) =>
    setCurrentId(slides[(index + step + slides.length) % slides.length].id)
  const own = streams.find((s) => s.effortId && s.effortId === slide.projectId)
  const watchable = own ?? streams.find((s) => s.embed) ?? streams[0]
  const link = more(slide)
  const stopped = paused || held

  return (
    <div className="min-w-0">
      <section
        aria-roledescription="carousel"
        aria-label="Latest updates"
        className="relative isolate flex min-h-[30rem] flex-col overflow-hidden text-white lg:aspect-video lg:min-h-0"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={(e) => setHeld(e.target.matches(":focus-visible"))}
        onBlur={() => setHeld(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1)
          if (e.key === "ArrowRight") go(1)
        }}
      >
        <div className="absolute inset-0 -z-10">
          <Sunset className="size-full" level={slide.level} />
          <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/45 to-black/5" />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent to-55%" />
        </div>

        <header className="flex items-center gap-3 p-4 text-sm sm:px-8 sm:pt-6">
          <span className="flex items-center gap-2 bg-black/60 px-2 py-1 font-semibold">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute size-full rounded-full bg-live motion-safe:animate-ping" />
              <span className="size-full rounded-full bg-live" />
            </span>
            On air
          </span>
          <Clock />
          <div className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous update"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => go(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={paused ? "Resume the show" : "Pause the show"}
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next update"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => go(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </header>

        <article
          key={slide.id}
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}`}
          className="flex flex-1 flex-col justify-end gap-3 px-4 pb-4 sm:gap-4 sm:px-8 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-right-10"
        >
          <SlideBody slide={slide} at={at} />
        </article>

        <footer className="space-y-4 px-4 pb-4 sm:px-8 sm:pb-6">
          <div className="flex flex-wrap gap-2">
            {watchable && (
              <Button size="lg" onClick={() => onWatch(watchable.id)}>
                <Play /> Watch {watchable.name} live
              </Button>
            )}
            <a
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "bg-black/50 text-white hover:bg-black/80 hover:text-white dark:hover:bg-black/80"
              )}
            >
              {link.label}
            </a>
          </div>
          <div aria-hidden="true" className="flex gap-1">
            {slides.map((s, i) => (
              <span key={s.id} className="h-1 flex-1 bg-white/25">
                {i < index && <span className="block h-full bg-white" />}
                {i === index && (
                  <span
                    key={slide.id}
                    className="block h-full origin-left bg-stripe-1 motion-safe:animate-[grow_linear_forwards]"
                    style={{
                      animationDuration: `${SECONDS}s`,
                      animationPlayState: stopped ? "paused" : "running",
                    }}
                    // The bar is the timer: pausing it pauses the show, and with reduced motion it never runs.
                    onAnimationEnd={() => go(1)}
                  />
                )}
              </span>
            ))}
          </div>
        </footer>
      </section>
      <Ticker commits={commits} at={at} paused={paused} />
    </div>
  )
}
