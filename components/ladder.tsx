import { LADDER } from "@/lib/ladder"
import { cn } from "@/lib/utils"

const said = (v: number) => (v >= 1 ? "yes" : v > 0 ? "partly" : "no")

/** Five steps from "exe runs" to "playable". A half-filled step was reached but is broken. */
export function Ladder({ steps }: { steps: number[] }) {
  const label = LADDER.map((m, i) => `${m.label}: ${said(steps[i])}`).join(", ")
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex gap-0.5">
      {LADDER.map((m, i) => (
        <span key={m.key} className="h-3.5 w-5 bg-foreground/12">
          <span
            className={cn("block h-full", steps[i] > 0 && steps[i] < 1 && "opacity-70")}
            style={{
              width: `${Math.min(1, steps[i]) * 100}%`,
              backgroundColor: `var(--step-${i + 1})`,
            }}
          />
        </span>
      ))}
    </span>
  )
}
