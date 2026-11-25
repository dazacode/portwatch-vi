"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import type { Commit } from "@/lib/broadcast"
import { ago } from "@/lib/format"

const SHORT = 6

type Pulse = { at: string; commits: Commit[] }

async function fetcher(url: string): Promise<Pulse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

export function CommitList({ commits, at }: { commits: Commit[]; at: string }) {
  const [all, setAll] = useState(false)
  // The list refreshes itself; the clock ticks separately so "12 s ago" stays honest.
  const { data } = useSWR<Pulse>("/api/pulse", fetcher, {
    fallbackData: { at, commits },
    refreshInterval: 15_000,
    keepPreviousData: true,
  })
  const pulse = data ?? { at, commits }
  const [, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])
  const now = new Date().toISOString()
  if (!pulse.commits.length) return null
  return (
    <section className="mt-6" aria-labelledby="commits">
      <h2 id="commits" className="border-b pb-1.5 text-sm font-medium">
        Last commit in every project{" "}
        <span className="font-normal text-muted-foreground">· live, {ago(pulse.at, now)}</span>
      </h2>
      <ul>
        {(all ? pulse.commits : pulse.commits.slice(0, SHORT)).map((c) => (
          <li key={c.projectId} className="border-b">
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-2 py-2 text-sm hover:bg-muted sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
            >
              <span className="truncate font-medium">{c.name}</span>
              <span className="col-span-2 row-start-2 truncate text-muted-foreground sm:col-span-1 sm:row-start-auto">
                {c.message}
              </span>
              <span className="text-muted-foreground">{ago(c.at, now)}</span>
            </a>
          </li>
        ))}
      </ul>
      {pulse.commits.length > SHORT && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${pulse.commits.length}`}
        </Button>
      )}
    </section>
  )
}
