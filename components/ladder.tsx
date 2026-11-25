"use client"

import { Popover } from "@base-ui/react/popover"
import Link from "next/link"
import { ROAD } from "@/lib/ladder"
import { cn } from "@/lib/utils"

const said = (v: number) => (v >= 1 ? "Yes" : v > 0 ? "Partly" : "Not yet")
const color = (i: number) => `var(--step-${i + 1})`

/**
 * Every step from "exe runs" to "story beaten". A half-filled step was reached but is broken.
 * What the colours mean opens on hover with a mouse, and on a tap or a key press without one.
 */
export function Ladder({ steps }: { steps: number[] }) {
  const label = ROAD.map((m, i) => `${m.label}: ${said(steps[i]).toLowerCase()}`).join(", ")
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label={`${label}. What the colours mean`}
        // The bars are thin, so the area that takes a tap is taller than they are.
        className="relative inline-flex cursor-help gap-0.5 after:absolute after:-inset-x-1 after:-inset-y-3"
      >
        {ROAD.map((m, i) => (
          <span key={m.key} className="h-3.5 w-4 bg-foreground/12">
            <span
              className={cn("block h-full", steps[i] > 0 && steps[i] < 1 && "opacity-70")}
              style={{ width: `${Math.min(1, steps[i]) * 100}%`, backgroundColor: color(i) }}
            />
          </span>
        ))}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} collisionPadding={12} className="isolate z-50">
          <Popover.Popup className="max-h-(--available-height) w-84 max-w-(--available-width) origin-(--transform-origin) overflow-y-auto rounded-2xl border bg-popover p-4 text-sm text-popover-foreground shadow-xl outline-none transition-[opacity,scale] duration-150 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            <Popover.Title className="font-semibold">What the colours mean</Popover.Title>
            <Popover.Description className="mt-1 text-xs text-muted-foreground">
              Each block is a step this project says it reached. Part filled means it got there, but
              broken. Grey means not yet.
            </Popover.Description>
            <ul className="mt-2.5 space-y-1.5">
              {ROAD.map((m, i) => (
                <li key={m.key} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-1 size-3 shrink-0"
                    style={{ backgroundColor: color(i) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-3">
                      <span className="font-medium">{m.label}</span>
                      <span className="shrink-0 text-xs/5 text-muted-foreground">
                        {said(steps[i])}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{m.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/method" className="mt-3 inline-block text-xs underline underline-offset-4">
              How projects are scored
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
