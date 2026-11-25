"use client"

import { User } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { HOME_ROOM, useMe, useWatching } from "@/components/watching/use-watching"
import { compact } from "@/lib/format"
import type { Snapshot } from "@/lib/live/types"
import { TRAILERS } from "@/lib/trailers"

const getLive = async (url: string): Promise<Snapshot> => (await fetch(url)).json()

/** How many people are here, and who. Nothing at all while the count is off. */
export function WatchingButton({
  room,
  className,
  size = "lg",
}: {
  /** Count only this stream on the button. */
  room?: string
  className?: string
  size?: "lg" | "sm"
}) {
  const [open, setOpen] = useState(false)
  const now = useWatching(open)
  const me = useMe()
  const { data: live } = useSWR<Snapshot>(open ? "/api/live" : null, getLive)
  if (!now) return null
  const count = room ? (now.rooms[room] ?? 0) : now.total
  const names = new Map([...(live?.streams ?? []), ...TRAILERS].map((s) => [s.id, s.name]))
  const label = (r: string) =>
    r === HOME_ROOM ? "Countdown" : (names.get(r) ?? "Elsewhere on the site")
  if (count === 0 && !open) return null
  // Places nobody can name are one group.
  const groups = new Map<string, { count: number; people: string[] }>()
  for (const [r, n] of Object.entries(now.rooms)) {
    const g = groups.get(label(r)) ?? { count: 0, people: [] }
    g.count += n
    groups.set(label(r), g)
  }
  for (const w of now.watchers) groups.get(label(w.room))?.people.push(w.name)

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        className={className}
        aria-label={`${count} watching ${room ? "this stream here" : "on this site"}. See who`}
        onClick={() => setOpen(true)}
      >
        <User aria-hidden="true" className="text-live" />
        <span className="tabular-nums">{compact(count)}</span>
        {room && <span>here</span>}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Who’s watching</SheetTitle>
            <SheetDescription>
              {now.total === 1 ? "1 person has" : `${compact(now.total)} people have`} this site
              open right now. The names are made up.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            {[...groups]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([name, g]) => (
                <section key={name}>
                  <h3 className="flex items-baseline justify-between text-sm font-medium">
                    <span className="truncate">{name}</span>
                    <span className="text-muted-foreground tabular-nums">{g.count}</span>
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {g.people.map((p, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: two people can draw the same name
                      <li key={p + i} className="truncate text-muted-foreground">
                        {p}
                        {p === me && " (you)"}
                      </li>
                    ))}
                    {g.count > g.people.length && (
                      <li className="text-muted-foreground">
                        and {g.count - g.people.length} more
                      </li>
                    )}
                  </ul>
                </section>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
