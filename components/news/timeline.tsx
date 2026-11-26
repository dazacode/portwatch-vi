import Link from "next/link"
import { utcTime } from "@/lib/format"
import { type Day, dayLabel, type Entry, type Kind } from "@/lib/timeline"
import { cn } from "@/lib/utils"

const TONE: Record<Kind, string> = {
  report: "text-stripe-2",
  held: "text-muted-foreground",
  article: "text-foreground",
  press: "text-muted-foreground",
  code: "text-muted-foreground",
  joined: "text-foreground",
  down: "text-destructive",
  takedown: "text-destructive",
}

const link = "underline-offset-4 hover:underline"

function Go({
  href,
  external,
  className,
  children,
}: {
  href: string
  external: boolean
  className?: string
  children: React.ReactNode
}) {
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn(link, className)}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cn(link, className)}>
      {children}
    </Link>
  )
}

function Row({ e }: { e: Entry }) {
  // A bare day has no time worth printing.
  const timed = e.at.length > 10
  return (
    <li className="border-b py-3.5 last:border-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className={cn("font-mono font-medium tracking-wide uppercase", TONE[e.kind])}>
          {e.label}
        </span>
        {timed && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={e.at}>{utcTime(e.at)}</time>
          </>
        )}
        {e.projectName && e.kind !== "code" && (
          <>
            <span aria-hidden="true">·</span>
            {e.projectId ? (
              <Link href={`/projects/${e.projectId}`} className={link}>
                {e.projectName}
              </Link>
            ) : (
              <span>{e.projectName}</span>
            )}
          </>
        )}
        {e.kind === "held" && (
          <>
            <span aria-hidden="true">·</span>
            <span>Under investigation</span>
          </>
        )}
      </p>
      <p className="mt-1 font-semibold text-balance">
        <Go href={e.href} external={e.external}>
          {e.title}
        </Go>
      </p>
      {e.detail && <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{e.detail}</p>}
      {e.subs.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l pl-3 text-sm">
          {e.subs.map((s) => (
            <li key={s.href + s.title}>
              <Go href={s.href} external={s.external}>
                {s.title}
              </Go>
              <span className="block text-xs text-muted-foreground">{s.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Everything, a day at a time. */
export function Timeline({ days, now }: { days: Day[]; now: string }) {
  if (days.length === 0) {
    return (
      <p className="pane mt-4 px-5 py-6 text-sm text-muted-foreground">
        Nothing on record for this yet.
      </p>
    )
  }
  return (
    <div className="mt-2 space-y-8">
      {days.map((d) => (
        <section key={d.day} aria-labelledby={`day-${d.day}`}>
          <h2 id={`day-${d.day}`} className="mb-2 text-sm font-semibold">
            {dayLabel(d.day, now)}{" "}
            <span className="font-normal text-muted-foreground">
              {d.entries.length} {d.entries.length === 1 ? "entry" : "entries"}
            </span>
          </h2>
          <ul className="pane px-5 py-1 wrap-anywhere">
            {d.entries.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
