"use client"

import NumberFlow from "@number-flow/react"
import { ChevronRight, Lock, Pause, Play, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { utcDay, utcTime } from "@/lib/format"
import { ROAD } from "@/lib/ladder"
import { type Frame, LANES } from "@/lib/race"
import { BASELINE_FPS } from "@/lib/stages.mjs"
import { cn } from "@/lib/utils"

const STEP = 900
const LANE = 2.75

// Project, bar, assessed, claimed.
const COLUMNS =
  "grid grid-cols-[7.5rem_minmax(0,1fr)_3rem_3rem] gap-x-3 sm:grid-cols-[11rem_minmax(0,1fr)_4.5rem_4.5rem]"

const ONE = { minimumFractionDigits: 1, maximumFractionDigits: 1 }

export type Stage = { label: string; at: number }

/** The furthest stage a claim reaches, by name. */
const stageOf = (stages: Stage[], claim: number) =>
  stages.filter((s) => s.at <= claim).at(-1)?.label ?? "Groundwork"

function Tile({
  label,
  children,
  note,
  strong = false,
}: {
  label: string
  children: React.ReactNode
  note: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className={cn("rounded-xl px-4 py-3", strong ? "bg-primary/12" : "bg-foreground/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={cn("mt-0.5 text-3xl font-extrabold tracking-tight", strong && "text-primary")}
      >
        {children}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

/**
 * Does GTA VI run on PC, how far, and who has got furthest. Ranked by our score: a claim counts
 * half until people outside the project confirm it. The claim is shown too, as the lighter part of
 * each bar. The history plays only when asked, so a first visit opens on today.
 */
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
    <section aria-labelledby="race" className="pane px-4 py-4 sm:px-6 sm:py-5">
      <h2 id="race" className="text-lg font-semibold">
        How far GTA VI runs on PC
      </h2>
      <p className="text-sm text-muted-foreground">
        {now ? "Today" : `As it stood on ${when}`}. No official PC version exists; these are fan
        projects running the console game.
      </p>

      {/* The answer, in three numbers. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile
          strong
          label="Furthest we can back up"
          note={
            best ? (
              <>
                <span translate="no" className="font-semibold text-foreground">
                  {best.name}
                </span>{" "}
                · our score, checked against outside reports
              </>
            ) : (
              "Our score, checked against outside reports"
            )
          }
        >
          {best ? <NumberFlow value={best.rating} suffix="%" format={ONE} /> : "—"}
        </Tile>
        <Tile
          label="Furthest claimed"
          note={
            furthest ? (
              <>
                <span translate="no" className="font-semibold text-foreground">
                  {furthest.name}
                </span>{" "}
                · what the project says about itself
              </>
            ) : (
              "What projects say about themselves"
            )
          }
        >
          {furthest ? <NumberFlow value={furthest.score} suffix="%" format={ONE} /> : "—"}
        </Tile>
        <Tile
          label="Playable on PC?"
          note={
            playable ? (
              <>
                <span translate="no" className="font-semibold text-foreground">
                  {playable}
                </span>{" "}
                has shown {BASELINE_FPS}+ fps and a clean picture, with proof
              </>
            ) : (
              `No build has shown ${BASELINE_FPS}+ fps with a clean picture, with proof`
            )
          }
        >
          {playable ? "Yes" : "Not yet"}
        </Tile>
      </div>

      {/* Who has got furthest. */}
      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h3 className="text-sm font-semibold">Leaders, by our score</h3>
          <p className="text-xs text-muted-foreground">Select a project for its full breakdown</p>
        </div>

        <div className="relative mt-2">
          {/* Stage lines behind the bars, with their names above. */}
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
            className={cn("relative text-[0.6875rem] text-muted-foreground", COLUMNS)}
          >
            <span>Project</span>
            <span className="relative h-4">
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
            <span className="text-right font-medium text-foreground">Our score</span>
            <span className="text-right">Claimed</span>
          </div>

          <ol className="relative mt-1" style={{ height: `${lanes * LANE}rem` }}>
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
                      "group h-full items-center rounded-md px-1 -mx-1 text-sm hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring",
                      COLUMNS
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {out ? "" : lane + 1}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="flex items-center gap-1.5">
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
                              className="size-3 shrink-0 text-muted-foreground"
                            />
                          )}
                        </span>
                        <span className="block truncate text-[0.6875rem] text-muted-foreground">
                          Claims: {stageOf(stages, shown.score)}
                        </span>
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="relative block h-3 overflow-hidden rounded-full bg-foreground/8"
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
                      className="flex items-center justify-end gap-1 text-right text-muted-foreground tabular-nums"
                    >
                      {shown.score}%
                      <ChevronRight className="size-3.5 shrink-0 opacity-0 group-hover:opacity-100 max-sm:hidden" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      {/* History, out of the way. */}
      {end > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
          <span>History</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
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
            className="h-6 min-w-0 flex-1 accent-primary sm:max-w-64"
          />
          <span className="font-medium text-foreground">{when}</span>
          {!now && (
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                setPlaying(false)
                setAt(end)
              }}
            >
              Back to today
            </button>
          )}
        </div>
      )}

      {/* What it all means. */}
      <div className="mt-3 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-primary" />
            <span>
              <span className="font-medium text-foreground">Our score</span>: a claim counts half
              until people outside the project confirm it
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-foreground/18" />
            <span>
              <span className="font-medium text-foreground">Claimed</span>: what the project says,
              the number PortWatch ranks by
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <Lock aria-hidden="true" className="size-3" />
            <span>
              <span className="font-medium text-foreground">Private build</span>: no public code, so
              nobody outside can test it
            </span>
          </li>
        </ul>
        <details className="group mt-2">
          <summary className="w-fit cursor-pointer list-none underline underline-offset-4 hover:text-foreground">
            What the stages mean
          </summary>
          <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {ROAD.map((m) => (
              <li key={m.key}>
                <span className="font-medium text-foreground">{m.label}</span>: {m.hint}
              </li>
            ))}
          </ol>
          <Link
            href="/method"
            className="mt-2 inline-block underline underline-offset-4 hover:text-foreground"
          >
            How projects are scored
          </Link>
        </details>
      </div>
    </section>
  )
}
