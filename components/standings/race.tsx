"use client"

import NumberFlow from "@number-flow/react"
import { Lock, Pause, Play, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { utcDay, utcTime } from "@/lib/format"
import { type Frame, LANES } from "@/lib/race"
import { type Ours, SCORE_KEYS, scoreColor } from "@/lib/score-colors"
import { cn } from "@/lib/utils"

const STEP = 900
const LANE = 2

// Name, bar, claimed, ours.
const COLUMNS =
  "grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem_2.75rem] gap-x-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_3.5rem_3.5rem]"

const one = (n: number) => Math.round(n * 10) / 10

export type Stage = { label: string; at: number }

/**
 * Each stage as its own block, as wide as the project claims it, so the blocks line up with the
 * stages. The solid part counts in our score; the faded rest is claimed but not confirmed.
 */
function Parts({ ours }: { ours: Ours | undefined }) {
  // Parts that share a colour (picture, speed and stability) are one block.
  const blocks: Ours["parts"] = []
  for (const p of ours?.parts ?? []) {
    if (p.claimed <= 0) continue
    const last = blocks.at(-1)
    if (last && scoreColor(last.key) === scoreColor(p.key)) {
      last.claimed += p.claimed
      last.counted += p.counted
      last.label = SCORE_KEYS.find((k) => k.keys.includes(p.key))?.label ?? last.label
    } else blocks.push({ ...p })
  }
  return (
    <span className="absolute inset-0 flex">
      {blocks.map((p) => {
        const color = scoreColor(p.key)
        return (
          <span
            key={p.key}
            title={`${p.label}: ${one(p.counted)} of ${one(p.claimed)} counts`}
            className="relative block h-full shrink-0 shadow-[inset_-1px_0_0_var(--background)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: `${p.claimed}%`,
              backgroundColor: `color-mix(in oklab, ${color} 28%, transparent)`,
            }}
          >
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${(p.counted / p.claimed) * 100}%`, backgroundColor: color }}
            />
          </span>
        )
      })}
    </span>
  )
}

/**
 * How far GTA VI runs on PC, and the race that led there: what each leader claims, the number
 * PortWatch ranks by, with our score for the same project drawn over it. The replay moves the
 * claims as they were recorded; our score is today's, so it shows once the replay reaches now.
 */
export function Race({ frames, stages }: { frames: Frame[]; stages: Stage[] }) {
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
      { threshold: 0.4 }
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

  const now = index === end
  const best = frame.best
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
  const lanes = Math.max(...frames.map((f) => f.racers.length))
  const when = now ? "Now" : `${utcDay(frame.at)}, ${utcTime(frame.at)}`
  const replay = () => {
    if (!playing && now) setAt(0)
    setPlaying(!playing)
  }

  return (
    <section ref={root} aria-labelledby="race" className="pane px-4 py-4 sm:px-6 sm:py-5">
      {/* How far GTA VI runs on PC */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2
            id="race"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            How far GTA VI runs on PC
          </h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <NumberFlow
                value={lead.score}
                suffix="%"
                format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                className="text-3xl font-extrabold tracking-tight [--number-flow-mask-height:0.08em]"
              />
              <span className="text-sm">
                {now ? "claimed" : "was claimed"} by{" "}
                <span translate="no" className="font-bold">
                  {lead.name}
                </span>
                {lead.ours && (
                  <span className="text-muted-foreground">
                    , {lead.ours.rating}% of it counts in our score
                  </span>
                )}
              </span>
            </p>
            {best && best.id !== lead.id && (
              <p className="text-sm">
                Highest by our count:{" "}
                <span translate="no" className="font-bold">
                  {best.name}
                </span>
                ,{" "}
                <NumberFlow
                  value={best.rating}
                  suffix="%"
                  format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                  className="font-bold [--number-flow-mask-height:0.08em]"
                />
              </p>
            )}
          </div>
        </div>
        {end > 0 && (
          <div className="flex items-center gap-2 max-sm:w-full">
            <Button
              variant="ghost"
              size="icon"
              className="max-sm:size-10"
              aria-label={playing ? "Pause the race" : now ? "Replay the race" : "Play"}
              onClick={replay}
            >
              {playing ? (
                <Pause aria-hidden="true" />
              ) : now ? (
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
              className="h-6 min-w-0 accent-primary max-sm:flex-1 sm:w-36"
            />
            <span className="w-26 shrink-0 text-right text-xs text-muted-foreground">{when}</span>
          </div>
        )}
      </div>

      {/* The whole game, 0 to 100, with the stages on it. */}
      <div aria-hidden="true" className="mt-4">
        <div className="relative h-4 overflow-hidden rounded-full bg-foreground/10">
          <Parts ours={lead.ours} />
        </div>
        <div className="relative mt-1 h-4">
          {stages.map((s) => (
            <span
              key={s.label}
              className={cn(
                "absolute top-0 border-l border-foreground/20 pl-1 text-[0.6875rem] leading-4 whitespace-nowrap text-muted-foreground",
                s.at === 100 && "-translate-x-full border-r border-l-0 pr-1 pl-0",
                s.at === 100 ? "max-sm:hidden" : s.at !== 50 && "max-lg:hidden"
              )}
              style={{ left: `${s.at}%` }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Who is behind whom. */}
      <div className="mt-5 border-t border-foreground/10 pt-3">
        <div aria-hidden="true" className={cn("text-[0.6875rem] text-muted-foreground", COLUMNS)}>
          <span>Project</span>
          <span />
          <span className="text-right">Claimed</span>
          <span className="text-right">Ours</span>
        </div>
        <ol className="relative mt-1" style={{ height: `${Math.min(lanes, LANES) * LANE}rem` }}>
          {everyone.map((r) => {
            const lane = frame.racers.findIndex((x) => x.id === r.id)
            const here = frame.racers[lane]
            const out = !here
            const ours = (here ?? r).ours
            const claim = (here ?? r).score
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
                  aria-label={`${r.name}: claims ${claim}%${ours ? `, ${ours.rating}% by our count` : ""}`}
                  className={cn(
                    "group h-full items-center rounded-md text-xs sm:text-sm focus-visible:outline-2 focus-visible:outline-ring",
                    COLUMNS
                  )}
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="w-3.5 shrink-0 text-right text-[0.6875rem] text-muted-foreground tabular-nums">
                      {out ? "" : lane + 1}
                    </span>
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
                  <span
                    aria-hidden="true"
                    className="relative block h-2.5 overflow-hidden rounded-full bg-foreground/10"
                  >
                    <Parts ours={ours} />
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-right text-muted-foreground tabular-nums"
                  >
                    {claim}%
                  </span>
                  <span aria-hidden="true" className="text-right font-semibold tabular-nums">
                    {ours ? `${ours.rating}%` : "·"}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>

      {/* What the colours mean. */}
      <div className="mt-3 border-t border-foreground/10 pt-3 text-[0.6875rem] text-muted-foreground">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-sm bg-foreground/80" />
            Counts in our score
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-sm bg-foreground/25" />
            Claimed, not confirmed
          </li>
          {SCORE_KEYS.map((k) => (
            <li key={k.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: k.color }}
              />
              {k.label}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 max-w-3xl">
          Each block is a stage, drawn as far as the project claims it, so the blocks line up with
          the stages. The solid part counts in our score; the faded rest is claimed, the way
          PortWatch counts it. A stage counts half until people outside the project confirm it, and
          everything past Runnable counts half until anyone can.{" "}
          <Link href="/method" className="underline underline-offset-4 hover:text-stripe-1">
            How projects are scored
          </Link>
          {!now && " Earlier moments use the claim then and the reports filed by then."}
        </p>
      </div>
    </section>
  )
}
