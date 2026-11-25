"use client"

import NumberFlow from "@number-flow/react"
import { Lock, Pause, Play, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { utcDay, utcTime } from "@/lib/format"
import { type Frame, LANES } from "@/lib/race"
import { cn } from "@/lib/utils"

const STEP = 900
const LANE = 1.625

// Name, bar, score.
const COLUMNS =
  "grid grid-cols-[6rem_minmax(0,1fr)_2.75rem] gap-x-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_3rem]"

export type Stage = { label: string; at: number }

/** How far anyone has got, and the race that led there. Plays once when it is first seen. */
export function Race({
  frames,
  stages,
  note,
}: {
  frames: Frame[]
  stages: Stage[]
  note?: string
}) {
  const end = frames.length - 1
  const [at, setAt] = useState(end)
  const [playing, setPlaying] = useState(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || end < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        watcher.disconnect()
        setAt(0)
        setPlaying(true)
      },
      { threshold: 0.6 }
    )
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [end])

  useEffect(() => {
    if (!playing) return
    if (at >= end) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setAt(at + 1), STEP)
    return () => clearTimeout(timer)
  }, [playing, at, end])

  const index = Math.min(at, end)
  const frame = frames[index]
  const lead = frame?.racers[0]
  if (!frame || !lead) return null

  // Everyone who is ever in a lane keeps one element, so it can move between lanes.
  // Today’s order first, which is the order they are read in.
  const everyone = [
    ...new Map(
      frames
        .toReversed()
        .flatMap((f) => f.racers)
        .map((r) => [r.id, r])
    ).values(),
  ]
  const when = index === end ? "Now" : `${utcDay(frame.at)}, ${utcTime(frame.at)}`
  const replay = () => {
    if (!playing && index === end) setAt(0)
    setPlaying(!playing)
  }

  return (
    <section ref={root} aria-labelledby="race" className="pane px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 text-sm">
          <h2 id="race" className="sr-only">
            How far GTA VI runs on PC
          </h2>
          <NumberFlow
            value={lead.score}
            suffix="%"
            format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            className="text-2xl font-extrabold tracking-tight [--number-flow-mask-height:0.08em]"
          />
          <p>
            <span translate="no" className="font-bold">
              {lead.name}
            </span>{" "}
            {index === end ? "claims" : "claimed"} the most.
          </p>
          {/* Keeps its place during the replay, so nothing below it moves. */}
          {note && (
            <p className={cn("text-muted-foreground", index !== end && "invisible")}>{note}</p>
          )}
        </div>
        {end > 0 && (
          <div className="flex items-center gap-2 max-sm:w-full">
            <Button
              variant="ghost"
              size="icon"
              className="max-sm:size-10"
              aria-label={playing ? "Pause the race" : index === end ? "Replay the race" : "Play"}
              onClick={replay}
            >
              {playing ? (
                <Pause aria-hidden="true" />
              ) : index === end ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </Button>
            <input
              type="range"
              aria-label="Moment in the race"
              aria-valuetext={`${when}, ${lead.name} first with ${lead.score}%`}
              min={0}
              max={end}
              value={index}
              onChange={(e) => {
                setPlaying(false)
                setAt(Number(e.target.value))
              }}
              className="h-6 min-w-0 accent-primary max-sm:flex-1 sm:w-32"
            />
            <span className="w-26 shrink-0 text-right text-xs text-muted-foreground">{when}</span>
          </div>
        )}
      </div>

      <div className="relative mt-1 pt-5">
        {/* The same three columns as a row, so the lines stand where the bars end. */}
        <div aria-hidden="true" className={cn("absolute inset-0", COLUMNS)}>
          <div className="relative col-start-2 h-full">
            {stages.map((s) => (
              <div
                key={s.label}
                className="absolute inset-y-0 border-l border-foreground/15"
                style={{ left: `${s.at}%` }}
              >
                <span
                  className={cn(
                    "absolute top-0 text-[0.6875rem] whitespace-nowrap text-muted-foreground",
                    s.at === 100 ? "right-1" : "left-1",
                    // A phone has room for one name.
                    s.at === 100 ? "max-sm:hidden" : s.at !== 50 && "max-lg:hidden"
                  )}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <ol className="relative" style={{ height: `${LANES * LANE}rem` }}>
          {everyone.map((r) => {
            const lane = frame.racers.findIndex((x) => x.id === r.id)
            const now = frame.racers[lane]
            const out = !now
            return (
              <li
                key={r.id}
                inert={out}
                aria-hidden={out}
                className={cn(
                  "absolute inset-x-0 top-0 transition-[translate,opacity] duration-700 ease-out motion-reduce:transition-none",
                  out && "opacity-0"
                )}
                style={{
                  height: `${LANE}rem`,
                  translate: `0 ${(out ? LANES - 1 : lane) * LANE}rem`,
                }}
              >
                <Link
                  href={`/projects/${r.id}`}
                  className={cn(
                    "group h-full items-center rounded-md text-xs sm:text-sm focus-visible:outline-2 focus-visible:outline-ring",
                    COLUMNS
                  )}
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      translate="no"
                      className={cn(
                        "truncate group-hover:underline",
                        lane === 0 ? "font-bold" : "font-medium"
                      )}
                    >
                      {r.name}
                    </span>
                    {r.isPrivate && (
                      <Lock
                        role="img"
                        aria-label="private build"
                        className="size-3 shrink-0 self-center text-muted-foreground"
                      />
                    )}
                  </span>
                  <span aria-hidden="true" className="block h-2 rounded-full bg-foreground/10">
                    <span
                      className={cn(
                        "block h-full rounded-full transition-[width,background-color] duration-700 ease-out motion-reduce:transition-none",
                        lane === 0 ? "bg-primary" : "bg-muted-foreground"
                      )}
                      style={{ width: `${now?.score ?? 0}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold">{(now ?? r).score}%</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
