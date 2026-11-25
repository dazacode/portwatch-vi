import Link from "next/link"
import type { BoardEvent } from "@/lib/board"
import { utcDay } from "@/lib/format"
import { cn } from "@/lib/utils"

const LABEL = { joined: "Joined", down: "Down", inactive: "Inactive" }

/** Projects that joined, went down or went quiet. */
export function BoardList({ events }: { events: BoardEvent[] }) {
  return (
    <ul className="pane mt-2 px-5 py-1 wrap-anywhere">
      {events.map((e) => (
        <li key={e.id} className="border-b py-3 last:border-0">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <Link
              href={`/projects/${e.projectId}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {e.title}
            </Link>
            <span
              className={cn(
                "ml-auto text-xs font-semibold",
                e.kind === "joined" ? "text-foreground" : "text-destructive"
              )}
            >
              {LABEL[e.kind]}
            </span>
            <span className="text-xs text-muted-foreground">{utcDay(e.at)}</span>
          </p>
          <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{e.detail}</p>
        </li>
      ))}
    </ul>
  )
}
