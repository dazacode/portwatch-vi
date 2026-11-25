"use client"

import {
  ChevronDown,
  GitCommitHorizontal,
  List,
  Maximize,
  Minimize,
  Pause,
  Play,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useEffect, useRef } from "react"
import type { useSound } from "@/components/broadcast/use-sound"
import { Clock } from "@/components/opening/clock"
import { CommitFeed } from "@/components/opening/commit-feed"
import { Leaders } from "@/components/opening/leaders"
import { Button } from "@/components/ui/button"
import { useFullscreen } from "@/components/use-fullscreen"
import type { Broadcast } from "@/lib/broadcast"
import { cn } from "@/lib/utils"

export type Panel = "leaders" | "commits"

const PANELS = [
  { id: "leaders", label: "Leaders", Icon: Trophy },
  { id: "commits", label: "Commits", Icon: GitCommitHorizontal },
] as const

const glass = "text-white hover:bg-white/20 hover:text-white dark:hover:bg-white/20"

/** The first screen: the clock over Miami. Everything else opens on request. */
export function Opening({
  broadcast,
  sound,
  panel,
  onPanel,
  onShow,
  still,
  onStill,
  phone,
}: {
  broadcast: Broadcast
  sound: ReturnType<typeof useSound>
  panel: Panel | null
  onPanel: (panel: Panel | null) => void
  onShow: () => void
  still: boolean
  onStill: (still: boolean) => void
  /** On a phone the updates are swiped, unless someone chose to view all of the page. */
  phone: { all: boolean; onAll: (all: boolean) => void } | null
}) {
  const { at, drop, leaders, everyone, commits, feed } = broadcast
  const { full, can: canFull, toggle: toggleFull } = useFullscreen()

  // Focus goes into a panel someone opens, and back to its button when they close it.
  const box = useRef<HTMLElement>(null)
  const asked = useRef(false)
  useEffect(() => {
    if (panel && asked.current) box.current?.focus({ preventScroll: true })
    asked.current = false
  }, [panel])
  const open = (next: Panel) => {
    asked.current = true
    onPanel(next)
  }
  const close = () => {
    if (panel && box.current?.contains(document.activeElement)) {
      document.getElementById(`open-${panel}`)?.focus({ preventScroll: true })
    }
    onPanel(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest("input, textarea, select, [role=dialog], [contenteditable=true]")) return
      if (e.key === "f") toggleFull()
      else if (e.key === "m") void sound.toggle()
      else if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <section
      aria-label="Since the drop"
      className="feed-page stage-height flex flex-col bg-linear-to-t from-black/70 via-black/30 via-40% to-black/30"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4 pt-8 pb-6 sm:px-8 lg:flex-row lg:justify-evenly short:flex-row short:justify-evenly short:gap-4 short:pt-4 short:pb-3">
        {drop && <Clock drop={drop} at={at} compact={panel !== null} />}
        {panel && (
          <section
            ref={box}
            id="opening-panel"
            tabIndex={-1}
            aria-label={panel === "leaders" ? "Leaders" : "Commits"}
            className="flex glass max-h-[46svh] short:max-h-[calc(100svh-6.5rem)] short:shrink min-h-0 w-full max-w-104 flex-col overflow-hidden rounded-4xl outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 lg:max-h-[min(38rem,74svh)] lg:shrink-0"
          >
            <div className="flex items-center justify-between pt-3 pr-3 pl-5">
              <h2 className="font-semibold">
                {panel === "leaders" ? "Leaders" : "Commits and pushes"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className={glass}
                aria-label="Close"
                onClick={close}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            {panel === "leaders" ? (
              <Leaders ranked={leaders} everyone={everyone} />
            ) : (
              <CommitFeed initial={{ at, commits, feed }} />
            )}
          </section>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-8 short:pb-3">
        <div className="glass flex items-center gap-1 rounded-full p-1">
          {phone ? (
            <Button size="lg" className="max-sm:px-4" onClick={() => phone.onAll(!phone.all)}>
              {phone.all ? <ChevronDown aria-hidden="true" /> : <List aria-hidden="true" />}
              {phone.all ? "Swipe" : "View all"}
            </Button>
          ) : (
            <Button size="lg" onClick={onShow}>
              <Play aria-hidden="true" /> News breakdowns
            </Button>
          )}
          {PANELS.map(({ id, label, Icon }) => (
            <Button
              key={id}
              id={`open-${id}`}
              variant="ghost"
              size="lg"
              aria-expanded={panel === id}
              aria-controls={panel === id ? "opening-panel" : undefined}
              className={cn(
                glass,
                "max-sm:px-4",
                "aria-expanded:bg-white/90 aria-expanded:text-black aria-expanded:hover:bg-white dark:aria-expanded:hover:bg-white"
              )}
              onClick={() => (panel === id ? close() : open(id))}
            >
              <Icon aria-hidden="true" className="max-sm:hidden" /> {label}
            </Button>
          ))}
        </div>
        <div className="glass flex items-center rounded-full p-1">
          <Button
            variant="ghost"
            size={sound.on ? "icon-lg" : "lg"}
            className={glass}
            aria-label={sound.on ? "Turn music off" : "Play music"}
            title="Music (M)"
            onClick={() => void sound.toggle()}
          >
            {sound.on ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            {!sound.on && <span className="max-md:hidden">Music</span>}
          </Button>
          {sound.on && (
            <input
              type="range"
              aria-label="Music volume"
              min={0}
              max={1}
              step={0.05}
              value={sound.volume}
              onChange={(e) => sound.setVolume(Number(e.target.value))}
              className="w-20 accent-stripe-1 max-sm:hidden"
            />
          )}
          <Button
            variant="ghost"
            size="icon-lg"
            className={glass}
            aria-label={still ? "Play the background" : "Pause the background"}
            title={still ? "Play the background" : "Pause the background"}
            onClick={() => onStill(!still)}
          >
            {still ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </Button>
          {canFull && (
            <Button
              variant="ghost"
              size="icon-lg"
              className={glass}
              aria-label={full ? "Leave full screen" : "Full screen"}
              title="Full screen (F)"
              onClick={toggleFull}
            >
              {full ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
