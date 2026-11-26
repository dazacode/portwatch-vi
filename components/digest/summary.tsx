import Link from "next/link"
import { DigestLabel } from "@/components/digest/label"
import type { Source, Summary } from "@/lib/digest"

const link = "underline underline-offset-4 hover:text-foreground"

function SourceLink({ source }: { source: Source }) {
  return source.external ? (
    <a href={source.href} target="_blank" rel="noreferrer" className={link}>
      {source.label}
    </a>
  ) : (
    <Link href={source.href} className={link}>
      {source.label}
    </Link>
  )
}

/** What matters now. The compact one is for the home page. Nothing without a digest. */
export function DigestSummary({
  summary,
  compact = false,
  busy = true,
}: {
  summary: Summary | null
  compact?: boolean
  /** The busy projects, when the page doesn't show them elsewhere. */
  busy?: boolean
}) {
  if (!summary) return null
  const points = compact ? summary.points.slice(0, 3) : summary.points
  return (
    <section aria-labelledby="summary" className={compact ? "mt-12" : "mt-6"}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id="summary" className="text-lg font-semibold">
          Summary
        </h2>
        {compact && (
          <Link
            href="/news?show=stories&sort=important"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            All stories by importance
          </Link>
        )}
      </div>
      <div className="pane px-5 py-2 wrap-anywhere">
        <ul className={compact ? "md:grid md:grid-cols-3 md:gap-x-8" : undefined}>
          {points.map((p) => (
            <li
              key={p.text}
              className={
                compact ? "border-b py-3 max-md:last:border-0 md:border-0" : "border-b py-3"
              }
            >
              <p className="max-w-prose text-pretty">{p.text}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {p.sources.map((s) => (
                  <SourceLink key={s.ref} source={s} />
                ))}
              </p>
            </li>
          ))}
        </ul>
        {!compact && busy && summary.projects.length > 0 && (
          <div className="border-b py-3">
            <h3 className="font-semibold">Busy projects</h3>
            <ul className="mt-1 space-y-2 text-sm">
              {summary.projects.map((p) => (
                <li key={p.id} className="max-w-prose">
                  {p.text}{" "}
                  <Link href={`/projects/${p.id}`} className={`text-muted-foreground ${link}`}>
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="py-2.5">
          <DigestLabel by={summary.by} at={summary.at} />
        </div>
      </div>
    </section>
  )
}
