import Link from "next/link"
import { Suspense } from "react"
import { BoardList } from "@/components/board/list"
import { Container } from "@/components/container"
import { Stories, StoriesFallback } from "@/components/digest/stories"
import { DigestSummary } from "@/components/digest/summary"
import { getBoard } from "@/lib/board"
import { getDigest, getSummary, toStories } from "@/lib/digest"
import { utcDay, utcTime } from "@/lib/format"
import { PAGES, pageMeta } from "@/lib/seo"
import { getNews, getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata = pageMeta(PAGES.news)

const link = "underline-offset-4 hover:underline"

export default async function Page() {
  const [tracker, feed, digest, board] = await Promise.all([
    getTracker(),
    getNews(),
    getDigest(),
    getBoard(),
  ])
  const { headlines, news, dmca } = tracker
  const list = { stories: toStories(feed, digest), sorted: digest !== null }
  const joined = board.filter((e) => e.kind === "joined")
  const dead = board.filter((e) => e.kind !== "joined")
  const notices = dmca.filter((d) => d.gta6)

  return (
    <Container className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section>
        <h1 className="text-2xl font-semibold">News</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Every public story about running GTA VI on PC. Scraped from news feeds, forums and GitHub
          every half hour and linked to where it was written.{" "}
          {feed.updated && <>Updated {utcDay(feed.updated)}.</>}
        </p>

        <DigestSummary summary={getSummary(digest, feed, tracker)} />

        {joined.length > 0 && (
          <section aria-labelledby="board" className="mt-8">
            <h2 id="board" className="text-lg font-semibold">
              New on the board
            </h2>
            <BoardList events={joined.slice(0, 6)} />
          </section>
        )}
        {dead.length > 0 && (
          <section aria-labelledby="dead" className="mt-6">
            <h2 id="dead" className="text-lg font-semibold">
              Moved to dead
            </h2>
            <BoardList events={dead.slice(0, 6)} />
          </section>
        )}

        <h2 className="mt-8 text-lg font-semibold">Stories</h2>
        <Suspense fallback={<StoriesFallback {...list} />}>
          <Stories {...list} />
        </Suspense>

        {news.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Articles</h2>
            <ul className="pane mt-2 px-5 py-2 wrap-anywhere">
              {news.map((n) => (
                <li key={n.id} className="border-b py-3 last:border-0">
                  <Link href={`/news/${n.id}`} className={link}>
                    <span className="block text-lg font-semibold text-balance">{n.title}</span>
                  </Link>
                  <span className="mt-1 block max-w-prose text-sm text-muted-foreground">
                    {n.dek}
                  </span>
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    {n.category},{" "}
                    <time dateTime={n.publishedAt ?? n.date}>
                      {utcDay(n.publishedAt ?? n.date)}
                      {n.publishedAt && `, ${utcTime(n.publishedAt)}`}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Every headline, oldest kept</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The press list that came before the harvester, kept for the record.
          </p>
          <ul className="pane mt-3 px-5 py-2 wrap-anywhere">
            {[...new Map(headlines.map((h) => [h.link, h])).values()].map((h) => (
              <li key={h.link} className="border-b py-2 text-sm last:border-0">
                <a href={h.link} target="_blank" rel="noreferrer" className={link}>
                  {h.title}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {h.outlet}, {utcDay(h.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside>
        <h2 className="text-lg font-semibold">Takedown notices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          GTA VI notices in GitHub’s public DMCA log.
        </p>
        <ul className="pane mt-4 px-5 py-2 wrap-anywhere">
          {notices.map((d) => (
            <li key={d.url} className="border-b py-3 text-sm last:border-0">
              <a href={d.url} target="_blank" rel="noreferrer" className={link}>
                Take-Two, {utcDay(d.date)}
              </a>
              {d.tracked.length > 0 && (
                <span className="block text-xs text-muted-foreground">
                  Names {d.tracked.join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </Container>
  )
}
