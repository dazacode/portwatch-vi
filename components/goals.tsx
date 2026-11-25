import type { Goal } from "@/lib/tracker"

/** The milestones past Runnable: what each one needs, where the project is, and the evidence. */
export function Goals({ goals }: { goals: Goal[] }) {
  return (
    <ul className="space-y-5">
      {goals.map((g) => (
        <li key={g.key} className="text-sm">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-medium">{g.label}</span>
            <span className="text-muted-foreground">{g.met ? "Reached" : "Not reached yet"}</span>
          </p>
          <ul className="pane mt-2 px-5 py-1 *:last:border-0">
            {g.checks.map((c) => (
              <li key={c.key} className="border-b py-3">
                <p className="flex flex-wrap justify-between gap-x-4">
                  <span>{c.label}</span>
                  <span className="text-muted-foreground">
                    {c.met ? "Shown" : c.claimed ? "Claimed, no evidence yet" : "Not yet"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.now}
                  {c.url && (
                    <>
                      .{" "}
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Evidence
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
