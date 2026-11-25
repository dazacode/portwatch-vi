import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/container"
import { utcDay } from "@/lib/format"
import { getNews, getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata: Metadata = { title: "News" }

const link = "underline-offset-4 hover:underline"
const CATEGORIES = ["Takedown", "Leak", "Port", "Legal", "Security", "Official", "Community"]

type Props = { searchParams: Promise<{ category?: string }> }

export default async function Page({ searchParams }: Props) {
  const [{ headlines, news, dmca }, feed, { category }] = await Promise.all([
    getTracker(),
    getNews(),
    searchParams,
  ])
  const notices = dmca.filter((d) => d.gta6)
  const shown = CATEGORIES.includes(category ?? "")
    ? feed.items.filter((n) => n.category === category)
    : feed.items
  const count = (c: string) => feed.items.filter((n) => n.category === c).length

  return (
    <Container className="grid gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section>
        <h1 className="text-2xl font-semibold">News</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Every public story about running GTA VI on PC. Scraped from news feeds, forums and GitHub
          every half hour and linked to where it was written.{" "}
          {feed.updated && <>Updated {utcDay(feed.updated)}.</>}
        </p>

        {news.length > 0 && (
          <div className="mt-6">
            <h2 className="border-b pb-1.5 text-sm font-medium">Our coverage</h2>
            <ul>
              {news.map((n) => (
                <li key={n.id} className="border-b py-3">
                  <Link href={`/news/${n.id}`} className={link}>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {n.category}
                    </span>
                    <span className="mt-0.5 block font-medium">{n.title}</span>
                  </Link>
                  <span className="mt-1 block text-sm text-muted-foreground">{n.dek}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{utcDay(n.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/news"
            className={category ? link : "font-medium underline underline-offset-4"}
          >
            All ({feed.items.length})
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/news?category=${c}`}
              className={category === c ? "font-medium underline underline-offset-4" : link}
            >
              {c} ({count(c)})
            </Link>
          ))}
        </div>

        <ul className="mt-3">
          {shown.map((h) => (
            <li key={h.id} className="border-b py-3">
              <a href={h.url} target="_blank" rel="noreferrer" className={link}>
                {h.title}
              </a>
              <span className="block text-xs text-muted-foreground">
                {h.outlet}, {utcDay(h.date)} · {h.via}
              </span>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">Nothing in this category yet.</li>
          )}
        </ul>

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Every headline, oldest kept</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The press list that came before the harvester, kept for the record.
          </p>
          <ul className="mt-3">
            {headlines.map((h) => (
              <li key={h.link} className="border-b py-2 text-sm">
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
        <ul className="mt-4">
          {notices.map((d) => (
            <li key={d.url} className="border-b py-3 text-sm">
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
