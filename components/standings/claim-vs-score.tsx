import { Lock } from "lucide-react"
import Link from "next/link"
import type { Project } from "@/lib/standings"
import { cn } from "@/lib/utils"

// Name, the two bars, the two numbers.
const COLUMNS =
  "grid grid-cols-[6rem_minmax(0,1fr)_4.25rem] gap-x-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_5rem]"

/** Which colour each part of our score is drawn in: the same blocks as each project's ladder. */
const KEYS: { color: string; label: string; keys: string[] }[] = [
  { color: "var(--step-1)", label: "Exe runs", keys: ["groundwork", "loads"] },
  { color: "var(--step-2)", label: "First frame", keys: ["boots"] },
  { color: "var(--step-3)", label: "Main menu", keys: ["menu"] },
  { color: "var(--step-4)", label: "In the world", keys: ["world"] },
  { color: "var(--step-5)", label: "Runnable", keys: ["playable"] },
  {
    color: "var(--step-6)",
    label: "Picture, speed, stability",
    keys: ["render", "perf", "stability", "manual"],
  },
  { color: "var(--step-7)", label: "Story", keys: ["story"] },
]

const colorOf = (key: string) => KEYS.find((k) => k.keys.includes(key))?.color ?? "var(--step-6)"

/**
 * What each leader claims, the way PortWatch ranks them, against our score for the same project.
 * Our score is drawn part by part, so it shows where the claim was discounted.
 */
export function ClaimVsScore({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null
  return (
    <section aria-labelledby="claim-vs-score" className="pane px-4 py-3 sm:px-5">
      <h2 id="claim-vs-score" className="text-sm font-semibold">
        What they claim, and what we count
      </h2>
      <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
        The grey bar is the claim, the number PortWatch ranks by. The coloured bar is our score for
        the same project. Each step it reached counts half until people outside the project confirm
        it, and everything past Runnable counts half until anyone can.{" "}
        <Link href="/method" className="underline underline-offset-4 hover:text-stripe-1">
          How projects are scored
        </Link>
      </p>

      <div className="relative mt-3">
        <ol className="relative space-y-2">
          {projects.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                aria-label={`${p.name}: claims ${p.score}%, our score ${p.rating}%`}
                className={cn(
                  "group items-center rounded-md py-0.5 text-xs sm:text-sm focus-visible:outline-2 focus-visible:outline-ring",
                  COLUMNS
                )}
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span
                    translate="no"
                    className={cn(
                      "truncate group-hover:underline",
                      i === 0 ? "font-bold" : "font-medium"
                    )}
                  >
                    {p.name}
                  </span>
                  {p.isPrivate && (
                    <Lock
                      role="img"
                      aria-label="private build"
                      className="size-3 shrink-0 self-center text-muted-foreground"
                    />
                  )}
                </span>
                <span aria-hidden="true" className="grid gap-1">
                  <span className="block h-1.5 rounded-full bg-foreground/10">
                    <span
                      className="block h-full rounded-full bg-muted-foreground/70"
                      style={{ width: `${p.score}%` }}
                    />
                  </span>
                  <span className="flex h-2.5 gap-px overflow-hidden rounded-full bg-foreground/10">
                    {p.parts
                      .filter((part) => part.counted > 0)
                      .map((part) => (
                        <span
                          key={part.key}
                          title={`${part.label}: ${Math.round(part.counted * 10) / 10} of ${Math.round(part.claimed * 10) / 10} claimed`}
                          className="block h-full shrink-0"
                          style={{ width: `${part.counted}%`, backgroundColor: colorOf(part.key) }}
                        />
                      ))}
                  </span>
                </span>
                <span aria-hidden="true" className="text-right leading-tight">
                  <span className="block text-[0.6875rem] text-muted-foreground">
                    {p.score}% claimed
                  </span>
                  <span className="block font-semibold">{p.rating}% ours</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-4 rounded-full bg-muted-foreground/70" />
          Claimed
        </li>
        {KEYS.map((k) => (
          <li key={k.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5" style={{ backgroundColor: k.color }} />
            {k.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
