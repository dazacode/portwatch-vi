"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Commit } from "@/lib/broadcast"
import { ago } from "@/lib/format"

const SHORT = 6

export function CommitList({ commits, at }: { commits: Commit[]; at: string }) {
  const [all, setAll] = useState(false)
  if (!commits.length) return null
  return (
    <section className="mt-6" aria-labelledby="commits">
      <h2 id="commits" className="border-b pb-1.5 text-sm font-medium">
        Last commit in every project
      </h2>
      <ul>
        {(all ? commits : commits.slice(0, SHORT)).map((c) => (
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
              <span className="text-muted-foreground">{ago(c.at, at)}</span>
            </a>
          </li>
        ))}
      </ul>
      {commits.length > SHORT && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${commits.length}`}
        </Button>
      )}
    </section>
  )
}
