"use client"

import { useEffect, useState } from "react"
import { span, utcDay, utcTime } from "@/lib/format"
import type { Drop } from "@/lib/tracker"
import { cn } from "@/lib/utils"

const two = (n: number) => String(n).padStart(2, "0")

/** Time since the Xbox build dropped. Before a release it counts down instead. */
export function Clock({
  drop,
  at,
  compact = false,
}: {
  drop: Drop
  at: string
  /** Beside an open panel. */
  compact?: boolean
}) {
  // Starts at the server's time, so the first paint matches, then follows the visitor's clock.
  const [now, setNow] = useState(() => Date.parse(at))
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  const target = Date.parse(drop.at)
  const due = !drop.released && now >= target
  const left = span(target, due ? target : now)
  const title = drop.released
    ? "since the Xbox build dropped"
    : due
      ? "The Xbox build is due"
      : "until the Xbox build is due"

  return (
    <div>
      <div
        role="timer"
        aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes ${title}`}
        className={cn(
          "leading-none font-bold tracking-tight text-white/95 tabular-nums",
          compact
            ? "text-[clamp(1.5rem,min(6.5vw,5.5svh),3rem)]"
            : "text-[clamp(1.75rem,min(8.6vw,10svh),5rem)]"
        )}
      >
        <span aria-hidden="true" className="flex justify-center gap-[0.32em]">
          <Unit value={String(left.days)} unit="d" />
          <Unit value={two(left.hours)} unit="h" />
          <Unit value={two(left.minutes)} unit="m" />
          <Unit value={two(left.seconds)} unit="s" />
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 font-bold text-balance",
          compact ? "text-base" : "text-base sm:text-2xl short:text-base"
        )}
      >
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-prose text-sm short:text-xs">
        {drop.released ? "Executable reported out" : "Expected"} {utcDay(drop.at)},{" "}
        {utcTime(drop.at)}. Not confirmed by Rockstar.
        {drop.source && (
          <>
            {" "}
            <a
              href={drop.source}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:decoration-2"
            >
              Source
            </a>
          </>
        )}
      </p>
    </div>
  )
}

/** A digit that changes drops into place. The others stay where they are. */
function Unit({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="whitespace-nowrap">
      {[...value].map((digit, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a digit is its place and its value
        <span key={`${value.length - i}:${digit}`} className="digit">
          {digit}
        </span>
      ))}
      <span className="ml-[0.05em] text-[0.42em] font-bold tracking-normal text-white/95">
        {unit}
      </span>
    </span>
  )
}
