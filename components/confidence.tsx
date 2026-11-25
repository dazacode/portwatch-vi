import { LADDER } from "@/lib/ladder"
import type { StageCheck } from "@/lib/tracker"
import { cn } from "@/lib/utils"

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`)

/** How sure we are of each stage, next to what the project says. */
export function Confidence({ stages, claimed }: { stages: StageCheck[]; claimed: number[] }) {
  return (
    <ul className="space-y-4">
      {stages.map((s, i) => {
        const percent = Math.round(s.confidence * 100)
        return (
          <li key={s.stage}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
              <span className="font-medium">{LADDER[i].label}</span>
              <span className="text-muted-foreground">
                {s.people ? people(s.people) : "No independent reports"}
                {s.failures > 0 && `, ${s.failures} could not`}
                {claimed[i] === 0 ? ", not claimed" : claimed[i] < 1 ? ", partly claimed" : ""}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${LADDER[i].label}: ${percent}% sure`}
              className="relative mt-1 h-3 bg-foreground/10"
            >
              <div
                className={cn("h-full", s.verified ? "bg-stripe-3" : "bg-stripe-2")}
                style={{ width: `${percent}%` }}
              />
              <span className="absolute inset-y-0 left-[70%] w-0.5 bg-foreground/60" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.verified ? `Verified, ${percent}% sure` : `${percent}% sure, 70% needed`}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
