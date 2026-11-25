"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import type { Commit, Pulse } from "@/lib/broadcast"
import { ago } from "@/lib/format"
import { cn } from "@/lib/utils"

async function fetcher(url: string): Promise<Pulse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

/** Commits from every project as they land. Ones that arrive while you watch are marked. */
export function CommitFeed({ initial }: { initial: Pulse }) {
  const { data, error } = useSWR<Pulse>("/api/pulse", fetcher, {
    fallbackData: initial,
    refreshInterval: 10_000,
    keepPreviousData: true,
  })
  const [first] = useState(initial)
  const pulse = data ?? first
  const { feed } = pulse

  // The page can be a minute old, so only what comes after the first refresh counts as new.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (pulse.at === first.at) return
    const known = seen.current
    seen.current = new Set([...(known ?? []), ...feed.map((c) => c.sha)])
    const arrived = known ? feed.filter((c) => !known.has(c.sha)).map((c) => c.sha) : []
    if (arrived.length) setFresh((before) => new Set([...before, ...arrived]))
  }, [pulse.at, first.at, feed])

  // Server time until mounted, so the first paint matches.
  const [now, setNow] = useState(initial.at)
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString())
    tick()
    const timer = setInterval(tick, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <p className="px-5 text-sm text-white/75">
        {error ? "Can’t reach the feed, retrying" : `Checked ${ago(pulse.at, now)}`}
      </p>
      {feed.length === 0 ? (
        <p className="flex-1 px-5 py-2 text-sm">
          No commits to show. GitHub’s feeds didn’t answer.
        </p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {feed.map((c) => (
            <Row key={c.sha} commit={c} now={now} fresh={fresh.has(c.sha)} />
          ))}
        </ul>
      )}
      <Link
        href="/activity"
        className="mx-5 mt-2 mb-4 w-fit text-sm underline underline-offset-4 hover:text-stripe-1"
      >
        All activity
      </Link>
    </>
  )
}

function Row({ commit, now, fresh }: { commit: Commit; now: string; fresh: boolean }) {
  return (
    <li className={cn(fresh && "bg-white/10 motion-safe:animate-in motion-safe:fade-in")}>
      <a
        href={commit.url}
        target="_blank"
        rel="noreferrer"
        className="block px-5 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex items-baseline gap-3">
          <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
            {commit.name}
          </span>
          <span className="shrink-0 text-xs text-white/75">
            {fresh && <span className="mr-2 font-semibold text-stripe-2">New</span>}
            {ago(commit.at, now)}
          </span>
        </span>
        <span className="block truncate text-white/85">{commit.message}</span>
      </a>
    </li>
  )
}
