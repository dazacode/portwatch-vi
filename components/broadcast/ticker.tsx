import type { Commit } from "@/lib/broadcast"
import { ago } from "@/lib/format"

function Run({ commits, at, hidden }: { commits: Commit[]; at: string; hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden} className="flex shrink-0">
      {commits.map((c) => (
        <li key={c.projectId} className="flex items-baseline gap-2 px-5 whitespace-nowrap">
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            tabIndex={hidden ? -1 : undefined}
            className="hover:underline"
          >
            <span className="font-semibold text-stripe-3">{c.name}</span>{" "}
            <span className="inline-block max-w-96 truncate align-bottom">{c.message}</span>
          </a>
          <span className="text-white/70">{ago(c.at, at)}</span>
        </li>
      ))}
    </ul>
  )
}

/** The last commit of every project. Scrolls by itself, or by hand with reduced motion. */
export function Ticker({
  commits,
  at,
  paused,
}: {
  commits: Commit[]
  at: string
  paused: boolean
}) {
  if (!commits.length) return null
  return (
    <section
      aria-label="Last commit in every project"
      className="flex overflow-x-auto bg-black/55 py-2.5 text-sm text-white motion-safe:overflow-hidden"
    >
      <div
        className="flex w-max hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-safe:animate-[ticker_linear_infinite]"
        style={{
          animationDuration: `${commits.length * 6}s`,
          animationPlayState: paused ? "paused" : undefined,
        }}
      >
        <Run commits={commits} at={at} />
        <div className="contents motion-reduce:hidden">
          <Run commits={commits} at={at} hidden />
        </div>
      </div>
    </section>
  )
}
