import type { Metadata } from "next"
import { Container } from "@/components/container"
import { utcDay } from "@/lib/format"
import { getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata: Metadata = { title: "News" }

const link = "underline-offset-4 hover:underline"

export default async function Page() {
  const { headlines, dmca } = await getTracker()
  const notices = dmca.filter((d) => d.gta6)
  return (
    <Container className="grid gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section>
        <h1 className="text-2xl font-semibold">News</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Headlines about the leak, ports and takedowns, linked to the outlets that wrote them.
        </p>
        <ul className="mt-4">
          {headlines.map((h) => (
            <li key={h.link} className="border-b py-3">
              <a href={h.link} target="_blank" rel="noreferrer" className={link}>
                {h.title}
              </a>
              <span className="block text-xs text-muted-foreground">
                {h.outlet}, {utcDay(h.date)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
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
      </section>
    </Container>
  )
}
