"use client"

import { X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import type { BoardEvent } from "@/lib/board"
import { cn } from "@/lib/utils"

const KEY = "board-seen"

async function fetcher(url: string): Promise<BoardEvent[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

function readSeen(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

/** Says when a project joins or goes down, on every page, until it is opened or closed. */
export function BoardNotice() {
  const { data } = useSWR<BoardEvent[]>("/api/board", fetcher, { refreshInterval: 60_000 })
  // Null until the browser's own list has been read.
  const [seen, setSeen] = useState<string[] | null>(null)
  useEffect(() => setSeen(readSeen()), [])
  const home = usePathname() === "/"

  const fresh = seen && data ? data.filter((e) => !seen.includes(e.id)) : []
  const [first] = fresh
  const close = () => {
    const next = [...new Set([...(seen ?? []), ...fresh.map((e) => e.id)])].slice(-100)
    setSeen(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {}
  }

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed inset-x-3 z-30 flex justify-center lg:inset-x-auto lg:right-6 lg:bottom-6",
        home
          ? "top-[max(0.75rem,env(safe-area-inset-top))] lg:top-auto"
          : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
      )}
    >
      {first && (
        <div className="glass pointer-events-auto flex max-w-sm items-center gap-2 rounded-full py-1 pr-1 pl-5 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 lg:motion-safe:slide-in-from-bottom-2">
          <Link
            href={fresh.length > 1 ? "/news#board" : `/projects/${first.projectId}`}
            onClick={close}
            className="min-w-0 py-2 underline-offset-4 hover:underline"
          >
            <span className="block truncate font-semibold">{first.title}</span>
            {fresh.length > 1 && (
              <span className="block text-xs">
                and {fresh.length - 1} more {fresh.length > 2 ? "changes" : "change"} to the board
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon-lg"
            className="shrink-0"
            aria-label="Close"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
