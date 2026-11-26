"use client"

import NumberFlow from "@number-flow/react"
import { Lock, Pause, Play, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { utcDay, utcTime } from "@/lib/format"
import { ROAD } from "@/lib/ladder"
import { type Frame, LANES } from "@/lib/race"
import { BASELINE_FPS } from "@/lib/stages.mjs"
import { cn } from "@/lib/utils"

const STEP = 900
const LANE = 1.75

// Project, bar, ours, claimed.
const COLUMNS =
  "grid grid-cols-[7rem_minmax(0,1fr)_2.75rem_2.5rem] gap-x-2 sm:grid-cols-[10rem_minmax(0,1fr)_4rem_3.5rem] sm:gap-x-3"

const ONE = { minimumFractionDigits: 1, maximumFractionDigits: 1 }

export type Stage = { label: string; at: number }

/** The furthest stage a claim reaches, by name. */
const stageOf = (stages: Stage[], claim: number) =>
  stages.filter((s) => s.at <= claim).at(-1)?.label ?? "Groundwork"

/** One number with a short label and who it belongs to. */
function Stat({
  label,
  children,
  who,
  strong = false,
}: {
  label: string
  children: React.ReactNode
  who: React.ReactNode
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2",
        strong ? "bg-primary/12" : "bg-foreground/5"
      )}
    >
      <p className="truncate text-[0.6875rem] text-muted-foreground">{label}</p>
      <div
        className={cn(
          "text-lg leading-tight font-extrabold tracking-tight sm:text-2xl",
          strong && "text-primary"
        )}
      >
        {children}
      </div>
      <p className="truncate text-[0.6875rem] text-muted-foreground">{who}</p>
    </div>
  )
}

export function Race({
  frames,
  stages,
  playable,
}: {
  frames: Frame[]
  stages: Stage[]
  /** The first project to reach our Playable goal with proof, if any has. */
  playable: string | null
}) {
  const end = frames.length - 1
  const [at, setAt] = useState(end)
  const [playing, setPlaying] = useState(false)

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
  if (!frame || frame.racers.length === 0) return null
  const now = index === end
  const { best, furthest } = frame

  // Everyone who is ever in a lane keeps one element, so it can move between lanes.
  const everyone = [
    ...new Map(
      frames
        .toReversed()
        .flatMap((f) => f.racers)
        .map((r) => [r.id, r])
    ).values(),
  ]
  const lanes = Math.min(LANES, Math.max(...frames.map((f) => f.racers.length)))
  const when = now ? "Today" : `${utcDay(frame.at)}, ${utcTime(frame.at)} UTC`
  const replay = () => {
    if (!playing && now) setAt(0)
    setPlaying(!playing)
  }

  return (
    <section aria-labelledby="race" className="pane px-3 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="race" className="text-base font-semibold">
          How far GTA VI runs on PC
        </h2>
        <p className="text-[0.6875rem] text-muted-foreground">
          {now ? "Today" : when} · fan projects, no official PC version
        </p>
      </div>

      {/* The answer, in three numbers. */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
        <Stat
          strong
          label="Backed up"
          who={
            best ? (
              <span translate="no" className="font-medium text-foreground">
                {best.name}
              </span>
            ) : (
              "Our score"
            )
          }
        >
          {best ? <NumberFlow value={best.rating} suffix="%" format={ONE} /> : "—"}
        </Stat>
        <Stat
          label="Claimed"
          who={
            furthest ? (
              <>
                <span translate="no" className="font-medium text-foreground">
                  {furthest.name}
                </span>
                <span className="max-sm:hidden"> · self-reported</span>
              </>
            ) : (
              "Self-reported"
            )
          }
        >
          {furthest ? <NumberFlow value={furthest.score} suffix="%" format={ONE} /> : "—"}
        </Stat>
        <Stat
          label="Playable?"
          who={
            playable ? (
              <span translate="no" className="font-medium text-foreground">
                {playable}
              </span>
            ) : (
              `${BASELINE_FPS} fps, proven`
            )
          }
        >
          {playable ? "Yes" : "Not yet"}
        </Stat>
      </div>

      {/* Who has got furthest, by our score. */}
      <div className="relative mt-3">
        <div aria-hidden="true" className={cn("absolute inset-0", COLUMNS)}>
          <div className="relative col-start-2 h-full">
            {stages.map((s) => (
              <div
                key={s.label}
                className="absolute inset-y-0 border-l border-foreground/10"
                style={{ left: `${s.at}%` }}
              />
            ))}
          </div>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "relative text-[0.625rem] text-muted-foreground sm:text-[0.6875rem]",
            COLUMNS
          )}
        >
          <span>By our score</span>
          <span className="relative h-3.5">
            {stages.map((s) => (
              <span
                key={s.label}
                className={cn(
                  "absolute top-0 whitespace-nowrap",
                  s.at === 100 ? "right-0" : "pl-1",
                  s.at === 100 ? "max-sm:hidden" : s.at !== 50 && "max-lg:hidden"
                )}
                style={s.at === 100 ? undefined : { left: `${s.at}%` }}
              >
                {s.label}
              </span>
            ))}
          </span>
          <span className="text-right font-medium text-foreground">Ours</span>
          <span className="text-right">Claimed</span>
        </div>

        <ol className="relative" style={{ height: `${lanes * LANE}rem` }}>
          {everyone.map((r) => {
            const lane = frame.racers.findIndex((x) => x.id === r.id)
            const here = frame.racers[lane]
            const out = !here
            const shown = here ?? r
            const ours = shown.ours?.rating ?? 0
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
                  translate: `0 ${(out ? lanes - 1 : lane) * LANE}rem`,
                }}
              >
                <Link
                  href={`/projects/${r.id}`}
                  aria-label={`${out ? "" : `${lane + 1}. `}${r.name}${r.isPrivate ? ", private build" : ""}: our score ${ours}%, claims ${shown.score}%, ${stageOf(stages, shown.score)}`}
                  className={cn(
                    "group -mx-1 h-full items-center rounded px-1 text-xs hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring sm:text-sm",
                    COLUMNS
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="w-3 shrink-0 text-right text-[0.625rem] text-muted-foreground tabular-nums">
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
                        aria-hidden="true"
                        className="size-2.5 shrink-0 text-muted-foreground"
                      />
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className="relative block h-2 overflow-hidden rounded-full bg-foreground/8 sm:h-2.5"
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-foreground/18 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: `${shown.score}%` }}
                    />
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                        lane === 0 ? "bg-primary" : "bg-primary/75"
                      )}
                      style={{ width: `${ours}%` }}
                    />
                  </span>
                  <span aria-hidden="true" className="text-right font-bold tabular-nums">
                    {shown.ours ? `${ours}%` : "—"}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-right text-muted-foreground tabular-nums"
                  >
                    {shown.score}%
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>

      {/* History and the key, one short row each. */}
      <div className="mt-2 flex items-center gap-2 border-t border-foreground/10 pt-2 text-[0.6875rem] text-muted-foreground">
        {end > 0 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={playing ? "Pause the history" : now ? "Replay the history" : "Play"}
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
              aria-label="Moment in the history"
              aria-valuetext={when}
              min={0}
              max={end}
              value={index}
              onChange={(e) => {
                setPlaying(false)
                setAt(Number(e.target.value))
              }}
              className="h-5 min-w-0 flex-1 accent-primary sm:max-w-56"
            />
            <span className="shrink-0 font-medium text-foreground">{when}</span>
            {!now && (
              <button
                type="button"
                className="shrink-0 underline underline-offset-4 hover:text-foreground"
                onClick={() => {
                  setPlaying(false)
                  setAt(end)
                }}
              >
                Today
              </button>
            )}
          </>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="h-2 w-4 rounded-full bg-primary" />
          Ours: claims count half until others confirm them
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="h-2 w-4 rounded-full bg-foreground/18" />
          Claimed by the project
        </span>
        <span className="flex items-center gap-1">
          <Lock aria-hidden="true" className="size-2.5" />
          Private code
        </span>
        <details className="w-full">
          <summary className="w-fit cursor-pointer list-none underline underline-offset-4 hover:text-foreground">
            What the stages mean
          </summary>
          <ol className="mt-1.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {ROAD.map((m) => (
              <li key={m.key}>
                <span className="font-medium text-foreground">{m.label}</span>: {m.hint}
              </li>
            ))}
          </ol>
          <Link
            href="/method"
            className="mt-1.5 inline-block underline underline-offset-4 hover:text-foreground"
          >
            How projects are scored
          </Link>
        </details>
      </div>
    </section>
  )
}
