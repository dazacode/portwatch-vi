import Link from "next/link"
import { Ladder } from "@/components/ladder"
import { ProjectDates } from "@/components/standings/project-dates"
import { compact } from "@/lib/format"
import { reportsText } from "@/lib/reports"
import { type Project, reporters } from "@/lib/standings"
import { cn } from "@/lib/utils"

const commits = (n: number) => (n >= 100 ? "100+" : n)

export function ProjectCard({
  project: p,
  large = false,
  className,
}: {
  project: Project
  large?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col", large ? "p-5" : "p-4", className)}>
      <div className="flex items-baseline gap-2.5">
        {/* On wide screens the block under a large card carries the number. */}
        <span
          className={cn(
            "font-bold text-muted-foreground",
            large ? "text-2xl lg:sr-only" : "text-xl"
          )}
        >
          <span className="sr-only">Rank </span>
          {p.rank}
        </span>
        <h3
          translate="no"
          className={cn(
            "min-w-0 font-bold break-words",
            large ? "text-2xl lg:text-3xl" : "text-lg"
          )}
        >
          <Link href={`/projects/${p.id}`} className="underline-offset-4 hover:underline">
            {p.name}
          </Link>
        </h3>
        <span className="ml-auto shrink-0 text-sm font-semibold">{p.stage}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Ladder steps={p.steps} />
        <span className="font-semibold">{p.rating}%</span>
        <span className="text-muted-foreground">
          {p.score}% claimed.{" "}
          {p.isPrivate
            ? "Private build"
            : p.verified > 0
              ? `${p.verified}% verified`
              : reportsText(reporters(p.checks))}
        </span>
      </div>
      {p.pick && <p className="mt-2 text-sm">{p.pick}</p>}
      {p.reason && !p.isPrivate && <p className="mt-2 text-sm">{p.reason}.</p>}
      <p className="mt-3 text-sm text-muted-foreground">{p.summary}</p>
      <div className="mt-auto grid gap-1.5 pt-4 text-xs text-muted-foreground">
        <p className="empty:hidden">
          {[
            p.fps ? `${p.fps} fps` : "",
            p.stars === null ? "" : `${compact(p.stars)} stars`,
            p.commits7d === null ? "" : `${commits(p.commits7d)} commits in 7 days`,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="flex flex-wrap gap-x-4">
          <ProjectDates project={p} />
        </p>
      </div>
    </div>
  )
}
