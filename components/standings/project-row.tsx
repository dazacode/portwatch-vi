import Link from "next/link"
import { GpuTags } from "@/components/gpu-tags"
import { Ladder } from "@/components/ladder"
import { ProjectDates } from "@/components/standings/project-dates"
import { TableCell, TableRow } from "@/components/ui/table"
import { compact } from "@/lib/format"
import { isGone, type Project } from "@/lib/standings"
import { cn } from "@/lib/utils"

const number = (n: number | null) => (n === null ? "–" : compact(n))

/** The rank is the place among every project, whatever the list around it is filtered or sorted by. */
export function ProjectRow({ project: p, strong = false }: { project: Project; strong?: boolean }) {
  return (
    <TableRow className={cn("[&>td]:py-3 [&>td]:align-top", isGone(p) && "text-muted-foreground")}>
      <TableCell className={cn("pl-0", strong && "text-lg/5 font-bold")}>
        {p.rank ?? (
          <>
            <span aria-hidden="true">–</span>
            <span className="sr-only">Not ranked</span>
          </>
        )}
      </TableCell>
      <TableCell className="whitespace-normal wrap-anywhere">
        <Link
          href={`/projects/${p.id}`}
          className={cn("font-medium underline-offset-4 hover:underline", strong && "text-base/5")}
        >
          {p.name}
        </Link>
        {p.tier === "watchlist" && (
          <span className="ml-2 text-xs text-muted-foreground">Watchlist</span>
        )}
        {p.pick && <span className="mt-0.5 block text-xs text-foreground">{p.pick}</span>}
        {p.reason && <span className="mt-0.5 block text-xs text-foreground">{p.reason}.</span>}
        <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">{p.stage}</span>
        <GpuTags gpus={p.gpus} className="mt-1" />
        <span
          className={cn(
            "mt-1 block max-w-2xl text-muted-foreground",
            strong ? "text-sm" : "text-xs/relaxed"
          )}
        >
          {p.summary}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground lg:hidden">
          <ProjectDates project={p} />
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {p.stage}
        <span className="mt-1 block">
          <Ladder steps={p.steps} />
        </span>
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
        <ProjectDates project={p} />
      </TableCell>
      <TableCell className="hidden text-right lg:table-cell">
        {p.commits7d !== null && p.commits7d >= 100 ? "100+" : number(p.commits7d)}
      </TableCell>
      <TableCell className="hidden text-right lg:table-cell">{number(p.stars)}</TableCell>
      <TableCell className="text-right text-muted-foreground">{p.score}%</TableCell>
      <TableCell className="pr-0 text-right font-semibold">{p.rating}%</TableCell>
    </TableRow>
  )
}
