import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ProjectTable({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 pl-0">Rank</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="hidden sm:table-cell">Reached</TableHead>
          <TableHead className="hidden lg:table-cell">Dates</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Commits, 7 days</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Stars</TableHead>
          <TableHead className="text-right">Claimed</TableHead>
          <TableHead className="pr-0 text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}
