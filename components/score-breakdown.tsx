import type { ScorePart } from "@/lib/tracker"
import { cn } from "@/lib/utils"

const points = (n: number) => (Math.round(n * 10) / 10).toString()

/** The sum behind a score: what is claimed for each part, and how much of it counts. */
export function ScoreBreakdown({ parts }: { parts: ScorePart[] }) {
  return (
    <ul className="space-y-4">
      {parts.map((p) => (
        <li key={p.key}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
            <span className="font-medium">{p.label}</span>
            <span className={cn("text-muted-foreground", p.note === null && "italic")}>
              {p.note === null
                ? "Not measured"
                : `${points(p.counted)} of ${points(p.claimed)} claimed`}
            </span>
          </div>
          <div aria-hidden="true" className="relative mt-1 h-3 bg-foreground/10">
            <div
              className="absolute inset-y-0 left-0 bg-stripe-2 opacity-35"
              style={{ width: `${(p.claimed / p.max) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-stripe-2"
              style={{ width: `${(p.counted / p.max) * 100}%` }}
            />
          </div>
          {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
        </li>
      ))}
    </ul>
  )
}
