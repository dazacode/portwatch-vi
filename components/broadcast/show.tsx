"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Backdrop } from "@/components/backdrop"
import { SlideBody } from "@/components/broadcast/slide"
import { Ticker } from "@/components/broadcast/ticker"
import type { useSound } from "@/components/broadcast/use-sound"
import { Button, buttonVariants } from "@/components/ui/button"
import { useFullscreen } from "@/components/use-fullscreen"
import type { Broadcast, Slide } from "@/lib/broadcast"
import { utcTime } from "@/lib/format"
import type { Stream } from "@/lib/live/types"
import { cutsIn, slideSeconds } from "@/lib/slides"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

const COVERED = 0.42
const glass = "text-white hover:bg-white/20 hover:text-white dark:hover:bg-white/20"

/** UTC clock. Empty until mounted, so the server and browser agree. */
function Clock() {
  const [now, setNow] = useState("")
  useEffect(() => {
    const tick = () => setNow(utcTime(new Date().toISOString()))
    tick()
    const timer = setInterval(tick, 5000)
    return () => clearInterval(timer)
  }, [])
  return <span className="max-sm:hidden">{now}</span>
}

const confettiSeen = new Set<string>()

async function celebrate(id: string) {
  if (confettiSeen.has(id)) return
  confettiSeen.add(id)
  const { default: confetti } = await import("canvas-confetti")
  const colors = ["#ff4fa3", "#ffb454", "#4fd8d8", "#ffffff"]
  for (const [x, angle] of [
    [0, 60],
    [1, 120],
  ]) {
    confetti({
      particleCount: 90,
      angle,
      spread: 70,
      startVelocity: 62,
      origin: { x, y: 0.9 },
      colors,
      disableForReducedMotion: true,
    })
  }
}

export const more = (slide: Slide) => {
  if (slide.kind === "commit")
    return { href: slide.commit.url, label: "See the commit", external: true }
  if (slide.kind === "trailer")
    return { href: slide.stream.url, label: "Open on YouTube", external: true }
  if (slide.kind === "wire")
    return { href: slide.item.url, label: "See the source", external: true }
  if (slide.kind === "board")
    return {
      href: `/projects/${slide.event.projectId}`,
      label: "See the project",
      external: false,
    }
  if (slide.kind === "breakdown") {
    const [first] = slide.breakdown.sources
    return { href: first.href, label: "See the source", external: first.external }
  }
  return { href: "/standings", label: "See the standings", external: false }
}

export function Show({
  broadcast,
  streams,
  answer,
  sound,
  channels,
  onWatch,
}: {
  broadcast: Broadcast
  streams: Stream[]
  answer: string
  sound: ReturnType<typeof useSound>
  channels: React.ReactNode
  onWatch: (id: string) => void
}) {
  const { slides, commits, at } = broadcast
  const root = useRef<HTMLElement>(null)
  const wipe = useRef<HTMLDivElement>(null)
  // The show moves to a slide, and the stripes cover the screen before it appears.
  const [currentId, setCurrentId] = useState(slides[0]?.id)
  const [shownId, setShownId] = useState(currentId)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const { full, can: canFull, toggle: toggleFull } = useFullscreen()
  const seen = useRef(new Set(slides.map((s) => s.id)))

  // A new milestone cuts straight in, like breaking news. Commits arrive too often for that.
  useEffect(() => {
    const fresh = slides.find((s) => !seen.current.has(s.id) && cutsIn(s))
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
  const target = slides[index]
  const slide = slides.find((s) => s.id === shownId) ?? target

  const go = (step: number) => {
    if (slides.length) setCurrentId(slides[(index + step + slides.length) % slides.length].id)
  }

  const cue = sound.cue
  useGSAP(
    () => {
      if (!target || target.id === shownId) return
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setShownId(target.id)
        return
      }
      cue({ kind: "slide" })
      const stripes = gsap.utils.toArray<HTMLElement>("[data-stripe]", wipe.current)
      const content = root.current?.querySelector("[data-content]") ?? null
      gsap.killTweensOf(stripes)
      gsap
        .timeline()
        .to(content, { x: -60, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0)
        .fromTo(
          stripes,
          { scaleX: 0, transformOrigin: "0% 50%" },
          { scaleX: 1, duration: 0.34, stagger: 0.06, ease: "power3.inOut" },
          0
        )
        .call(() => setShownId(target.id), undefined, COVERED)
        .set(content, { x: 0, autoAlpha: 1 }, COVERED)
        .fromTo(
          stripes,
          { scaleX: 1, transformOrigin: "100% 50%" },
          {
            scaleX: 0,
            duration: 0.42,
            stagger: 0.06,
            ease: "power3.inOut",
            immediateRender: false,
          },
          COVERED + 0.08
        )
    },
    { dependencies: [target?.id] }
  )

  const milestone = slide?.kind === "milestone" ? slide : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per slide shown
  useEffect(() => {
    if (!milestone) return
    cue({ kind: "milestone", stars: milestone.stars })
    if (milestone.stars < 5) return
    const timer = setTimeout(() => void celebrate(milestone.id), 1300)
    return () => clearTimeout(timer)
  }, [milestone?.id])

  // Keys work anywhere on the page while the show is in view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, select, [role=dialog], [contenteditable=true]")) return
      if ((root.current?.getBoundingClientRect().bottom ?? 0) < 120) return
      if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "ArrowRight") go(1)
      else if (e.key === "f") toggleFull()
      else if (e.key === "m") void sound.toggle()
      else if (e.key === "n" && sound.on) sound.next()
      else if (e.key === "p") setPaused((p) => !p)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!slide || !target) return null
  const own = streams.find((s) => s.effortId && s.effortId === slide.projectId)
  const watchable =
    slide.kind === "trailer" ? slide.stream : (own ?? streams.find((s) => s.embed) ?? streams[0])
  const link = more(slide)
  const stopped = paused || held

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="Latest updates"
      className="dark stage-height relative isolate flex flex-col overflow-hidden bg-black text-white"
    >
      <div className="absolute inset-0 -z-10">
        <Backdrop paused={paused} />
        <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/50 via-50% to-black/10 max-lg:to-black/30 max-lg:to-100%" />
        <div className="absolute inset-0 bg-linear-to-t from-black/75 to-transparent to-40%" />
      </div>

      <header className="flex items-center gap-2 p-3 text-sm sm:gap-3 sm:px-8 sm:pt-5 short:py-2">
        <span className="flex items-center gap-2 glass rounded-full px-4 py-1.5 font-semibold whitespace-nowrap">
          <span aria-hidden="true" className="relative flex size-2">
            <span className="size-full rounded-full bg-live" />
          </span>
          On air
        </span>
        <Clock />
        <span className="glass rounded-full px-4 py-1.5 max-md:hidden">{answer}</span>
        <div className="ml-auto flex items-center gap-0.5 glass rounded-full p-1">
          <Button
            variant="ghost"
            size="icon"
            className={glass}
            aria-label={sound.on ? "Turn sound off" : "Turn sound on"}
            title="Sound (M)"
            onClick={() => void sound.toggle()}
          >
            {sound.on ? <Volume2 /> : <VolumeX />}
          </Button>
          {sound.on && (
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={sound.volume}
              onChange={(e) => sound.setVolume(Number(e.target.value))}
              className="w-20 accent-stripe-1 max-sm:hidden"
            />
          )}
          {sound.on && (
            <>
              <span
                aria-live="polite"
                title={sound.track.mood}
                className="ml-1 max-w-28 truncate text-white/85 max-xl:hidden"
              >
                {sound.track.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className={glass}
                aria-label={`Next track (now playing ${sound.track.title})`}
                title="Next track (N)"
                onClick={sound.next}
              >
                <SkipForward />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={glass}
            aria-label="Previous update"
            onClick={() => go(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={glass}
            aria-label={paused ? "Resume the show" : "Pause the show"}
            title="Pause (P)"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={glass}
            aria-label="Next update"
            onClick={() => go(1)}
          >
            <ChevronRight />
          </Button>
          {canFull && (
            <Button
              variant="ghost"
              size="icon"
              className={glass}
              aria-label={full ? "Leave full screen" : "Full screen"}
              title="Full screen (F)"
              onClick={toggleFull}
            >
              {full ? <Minimize /> : <Maximize />}
            </Button>
          )}
        </div>
      </header>
      <div
        data-content
        className="mx-auto flex w-full max-w-[110rem] flex-1 flex-col justify-end gap-5 px-4 pb-4 sm:gap-7 sm:px-8 sm:pb-6 short:gap-3 short:pb-3"
      >
        <article
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}`}
          // Read out only when it was asked for, not each time the show moves on.
          aria-live={paused ? "polite" : "off"}
          className="w-full"
        >
          <SlideBody key={slide.id} slide={slide} at={at} onHold={setHeld} />
        </article>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: reaching for a button only holds the timer */}
        <div
          className="flex w-fit flex-wrap gap-2"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={(e) => setHeld(e.target.matches(":focus-visible"))}
          onBlur={() => setHeld(false)}
        >
          {watchable && (
            <Button size="lg" onClick={() => onWatch(watchable.id)}>
              <Play />{" "}
              {slide.kind === "trailer" ? "Play the trailer" : `Watch ${watchable.name} live`}
            </Button>
          )}
          <a
            href={link.href}
            {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "glass text-white hover:bg-white/20 hover:text-white dark:hover:bg-white/20"
            )}
          >
            {link.label}
          </a>
          {channels}
        </div>
      </div>

      <div aria-hidden="true" className="flex gap-1 px-4 pb-4 sm:px-8 short:pb-1">
        {slides.map((s, i) => (
          <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            {i < index && <span className="block h-full bg-white" />}
            {i === index && (
              <span
                key={target.id}
                className="block h-full origin-left bg-stripe-1 motion-safe:animate-[grow_linear_forwards]"
                style={{
                  animationDuration: `${slideSeconds(target)}s`,
                  animationPlayState: stopped ? "paused" : "running",
                }}
                // The bar is the timer: pausing it pauses the show, and with reduced motion it never runs.
                onAnimationEnd={() => go(1)}
              />
            )}
          </span>
        ))}
      </div>
      <Ticker commits={commits} at={at} paused={paused} />

      <div ref={wipe} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 grid">
        {["bg-stripe-1", "bg-stripe-2", "bg-stripe-3"].map((c) => (
          <div key={c} data-stripe className={cn("[transform:scaleX(0)]", c)} />
        ))}
      </div>
    </section>
  )
}
