import Link from "next/link"
import { ago, utcTime } from "@/lib/format"
import { confidenceLabel, type IntelItem, KIND_LABEL, sourceCount } from "@/lib/intel"

const TONE: Record<string, string> = {
  high: "text-stripe-2",
  moderate: "text-foreground",
  low: "text-muted-foreground",
}

/** One line of the feed. A held item says so and links to its provisional page. */
export function IntelCard({ item, now }: { item: IntelItem; now: string }) {
  const held = item.status !== "published"
  return (
    <article className="border-b py-4 last:border-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-wide">
          {KIND_LABEL[item.kind] ?? item.kind}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.at} title={utcTime(item.at)}>
          {ago(item.at, now)}
        </time>
        {item.projectName && (
          <>
            <span aria-hidden="true">·</span>
            {item.projectId ? (
              <Link
                href={`/projects/${item.projectId}`}
                className="underline-offset-4 hover:underline"
              >
                {item.projectName}
              </Link>
            ) : (
              <span>{item.projectName}</span>
            )}
          </>
        )}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-balance">
        <Link href={`/intelligence/${item.id}`} className="underline-offset-4 hover:underline">
          {item.title}
        </Link>
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{item.oneLine}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span
          className={`font-medium ${held ? "text-muted-foreground" : (TONE[item.confidence?.bucket] ?? "")}`}
        >
          {held && item.status === "held" ? "Under investigation" : confidenceLabel(item)}
        </span>
        <span className="text-muted-foreground">
          {sourceCount(item)} source{sourceCount(item) === 1 ? "" : "s"}
        </span>
        {item.status === "retracted" && <span className="text-muted-foreground">Retracted</span>}
      </p>
    </article>
  )
}
