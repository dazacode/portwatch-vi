"use client"

import Link from "next/link"
import { RanksTabs } from "@/components/ranks-tabs"
import { setRanks, useRanks } from "@/components/use-ranks"
import type { Leader } from "@/lib/broadcast"
import { reportsText } from "@/lib/reports"
import { cn } from "@/lib/utils"

/** The top of the race, by our score. */
export function Leaders({ ranked, everyone }: { ranked: Leader[]; everyone: Leader[] }) {
  const ranks = useRanks()
  const withPrivate = ranks === "everyone"
  const leaders = withPrivate ? everyone : ranked
  return (
    <>
      <RanksTabs className="px-5 pt-1 pb-2" ranks={ranks} onChange={setRanks} />
      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {leaders.map((l, i) => (
          <li key={l.id}>
            <Link
              href={`/projects/${l.id}`}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span className="w-4 text-white/85">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span
                  translate="no"
                  className={cn("block truncate", i === 0 ? "text-xl font-bold" : "font-semibold")}
                >
                  {l.name}
                </span>
                <span className="block truncate text-xs text-white/75">
                  {l.picked && "Placed by us. "}
                  {l.isPrivate ? "Private build" : reportsText(l.reporters)}, {l.score}% claimed
                </span>
              </span>
              <span className="shrink-0 text-lg font-bold">{l.rating}%</span>
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href={withPrivate ? "/standings?ranks=everyone" : "/standings"}
        className="mx-5 mt-2 mb-4 w-fit text-sm underline underline-offset-4 hover:text-stripe-1"
      >
        All standings
      </Link>
    </>
  )
}
