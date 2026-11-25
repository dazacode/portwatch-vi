import type { Metadata } from "next"
import { Container } from "@/components/container"
import { SIZES } from "@/lib/milestones"
import { MILESTONES, TRACKS } from "@/lib/scoring.mjs"
import { getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata: Metadata = { title: "Method" }

const RULES = [
  "Less than 2 points",
  "2 to 5 points",
  "5 to 10 points",
  "10 to 20 points",
  "20 points or more, or a first",
]
const RATINGS = SIZES.map((size, i) => [size, RULES[i]])

export default async function Page() {
  const { flagged } = await getTracker()
  return (
    <Container>
      <div className="max-w-2xl space-y-10 pt-8">
        <section>
          <h1 className="text-2xl font-semibold">How projects are scored</h1>
          <p className="mt-2 text-muted-foreground">
            The first half of the score is getting in. Each step needs the one before it.
          </p>
          <dl className="mt-4">
            {MILESTONES.map((m) => (
              <div key={m.key} className="grid grid-cols-[3rem_1fr] border-b py-3 text-sm">
                <dt className="contents">
                  <span className="text-muted-foreground">{m.at}%</span>
                  <span className="font-medium">{m.label}</span>
                </dt>
                <dd className="col-start-2 text-muted-foreground">{m.desc}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-muted-foreground">
            Once a build is playable, four things fill the other half.
          </p>
          <dl className="mt-4">
            {TRACKS.map((t) => (
              <div key={t.key} className="grid grid-cols-[3rem_1fr] border-b py-3 text-sm">
                <dt className="contents">
                  <span className="text-muted-foreground">{t.weight * 100}%</span>
                  <span className="font-medium">{t.label}</span>
                </dt>
                <dd className="col-start-2 text-muted-foreground">{t.desc}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="text-lg font-semibold">How milestones are rated</h2>
          <p className="mt-2 text-muted-foreground">
            Stars measure how many points a project gained at once, next to its previous jump.
          </p>
          <dl className="mt-4">
            {RATINGS.map(([size, rule], i) => (
              <div key={size} className="grid grid-cols-[3rem_1fr] border-b py-3 text-sm">
                <dt className="contents">
                  <span className="text-muted-foreground">{i + 1}/5</span>
                  <span className="font-medium">{size}</span>
                </dt>
                <dd className="col-start-2 text-muted-foreground">{rule}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            The first project to reach a stage always gets five. A project new to the board has no
            earlier score, so it gets five if it takes the lead, three if it is already playable,
            and one otherwise. A correction within six hours changes the milestone it corrects.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">How streams are found</h2>
          <p className="mt-2 text-muted-foreground">
            Channels linked from a tracked project’s README are followed automatically. Other
            streams appear only if their title names both the game and port work. Any title that
            offers a download, a key or a giveaway is dropped, even from a followed channel.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Fakes to avoid</h2>
          <dl className="mt-2">
            {flagged.map((f) => (
              <div key={f.id} className="border-b py-3 text-sm">
                <dt className="font-medium">{f.pattern}</dt>
                <dd className="mt-0.5 text-muted-foreground">{f.reason}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Container>
  )
}
