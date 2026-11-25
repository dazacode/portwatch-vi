import { Ladder } from "@/components/ladder"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { compact } from "@/lib/format"
import type { Standing } from "@/lib/tracker"
import { cn } from "@/lib/utils"

const status = (s: Standing) =>
  s.nuked
    ? "Taken offline"
    : s.missing
      ? "Repo not reachable"
      : [s.isPrivate && "Private build", !s.verified && "Unverified"].filter(Boolean).join(", ")

export function StandingsTable({
  rows,
  detailed = false,
}: {
  rows: Standing[]
  detailed?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-0">Project</TableHead>
          <TableHead>Reached</TableHead>
          <TableHead className="hidden sm:table-cell">Steps to playable</TableHead>
          <TableHead className="hidden text-right md:table-cell">FPS</TableHead>
          <TableHead className="hidden text-right md:table-cell">Commits, 7 days</TableHead>
          <TableHead className="hidden text-right md:table-cell">Stars</TableHead>
          <TableHead className="pr-0 text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow
            key={s.id}
            className={cn("[&>td]:align-top", s.nuked && "text-muted-foreground")}
          >
            <TableCell className="pl-0 whitespace-normal">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {s.name}
                </a>
              ) : (
                <span className="font-medium">{s.name}</span>
              )}
              <span className="block text-xs text-muted-foreground">{status(s)}</span>
              {detailed && (
                <span className="mt-1 block max-w-prose text-sm text-muted-foreground">
                  {s.summary}
                </span>
              )}
            </TableCell>
            <TableCell>{s.stage}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <Ladder steps={s.steps} />
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">{s.fps || "–"}</TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {s.commits7d === null ? "–" : s.commits7d >= 100 ? "100+" : s.commits7d}
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              {s.stars === null ? "–" : compact(s.stars)}
            </TableCell>
            <TableCell className="pr-0 text-right font-medium">{s.score}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
