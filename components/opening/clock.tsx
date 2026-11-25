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
    // Some clips are bright right behind the clock, so a soft shade lies between the two.
    <div className="relative isolate text-center before:pointer-events-none before:absolute before:-inset-x-5 before:-inset-y-8 before:-z-10 before:rounded-full before:bg-black/42 before:blur-2xl sm:before:-inset-12 sm:before:rounded-4xl sm:before:blur-3xl">
      <div className="drop-shadow-[0_2px_18px_rgb(0_0_0/0.45)]">
        <div
          role="timer"
          aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes`}
          className={cn(
            "leading-none font-bold tracking-tight text-white/95 tabular-nums",
            compact
              ? "text-[clamp(2.4rem,min(10.5vw,17svh),4.5rem)] short:text-[clamp(2rem,6vw,3.5rem)] xl:text-8xl"
              : "text-[clamp(2.6rem,min(11.5vw,26svh),10rem)]"
          )}
        >
          <span aria-hidden="true" className="flex justify-center gap-[0.28em]">
            <Unit value={String(left.days)} unit="d" />
            <Unit value={two(left.hours)} unit="h" />
            <Unit value={two(left.minutes)} unit="m" />
            <Unit value={two(left.seconds)} unit="s" />
          </span>
        </div>
        <h2 className="mt-2 text-xl font-bold text-balance sm:mt-3 sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm">
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
    </div>
  )
}

function Unit({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="whitespace-nowrap">
      {value}
      <span className="ml-[0.05em] text-[0.42em] font-bold tracking-normal text-white/95">
        {unit}
      </span>
    </span>
  )
}
