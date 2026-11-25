import { Container } from "@/components/container"
import { SIZES } from "@/lib/milestones"
import { CLAIM_SHARE } from "@/lib/rating.mjs"
import { MILESTONES, TRACKS } from "@/lib/scoring.mjs"
import { PAGES, pageMeta } from "@/lib/seo"
import { SOURCE } from "@/lib/site"
import { getTracker } from "@/lib/tracker"
import { VERIFIED_AT, WEIGHTS } from "@/lib/verification.mjs"

export const revalidate = 300
export const metadata = pageMeta(PAGES.method)

const RULES = [
  "Less than 2 points",
  "2 to 5 points",
  "5 to 10 points",
  "10 to 20 points",
  "20 points or more, or a first",
]
const EVIDENCE = [
  [
    WEIGHTS.challenge,
    "Live challenge",
    "Random in-game actions and a code, on a recorded stream, watched by a person.",
  ],
  [
    WEIGHTS.tester,
    "Independent tester",
    "Names a real commit, a graphics card and how far the game got. Not a project member, account at least 90 days old, not a copy.",
  ],
  [
    WEIGHTS.contributor,
    "Tester who contributed code",
    "The same, from someone whose code the project has merged.",
  ],
  [WEIGHTS.rule, "Matched by text rules", "The same, when only text rules have read the report."],
].map(([weight, ...rest]) => [Math.round(Number(weight) * 100), ...rest])
const percent = (n: number) => `${Math.round(n * 100)}%`
const RATINGS = SIZES.map((size, i) => [size, RULES[i]])

export default async function Page() {
  const { flagged } = await getTracker()
  return (
    <Container>
      <div className="max-w-2xl space-y-10 pt-8">
        <section>
          <h1 className="text-2xl font-semibold">How projects are scored</h1>
          <p className="mt-2 text-muted-foreground">
            A project’s score is what it claims, discounted by how little of it anyone else has
            seen. A claim nobody has tested counts {percent(CLAIM_SHARE)}. Each stage rises from
            there to its full points as reports come in, and gets all of them once it is{" "}
            {percent(VERIFIED_AT)} sure.
          </p>
          <p className="mt-2 text-muted-foreground">
            Story, rendering, performance and stability always count {percent(CLAIM_SHARE)}, because
            no report can confirm them yet. What was never measured earns nothing, and is shown as
            not measured, not as a bad result. Private builds follow the same rules.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">What a claim is worth</h2>
          <p className="mt-2 text-muted-foreground">
            The scale and most claims come from{" "}
            <a
              href={SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              {SOURCE.name}
            </a>
            , checked every minute when someone visits. Where we found something newer, a project’s
            page shows both numbers, and theirs takes over again as soon as they change it. The
            score and the ranking are ours.
          </p>
          <p className="mt-2 text-muted-foreground">
            The first half of a claim is getting in. Each step needs the one before it.
          </p>
          <dl className="pane mt-4 px-5 py-1 *:last:border-0">
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
          <dl className="pane mt-4 px-5 py-1 *:last:border-0">
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
          <h2 className="text-lg font-semibold">How claims are verified</h2>
          <p className="mt-2 text-muted-foreground">
            Nobody can prove a run from a distance, so this measures how hard it would be to fake.
            Each person counts once. A stage is verified at 70%, along with every stage before it,
            and is worth up to 50 points. Story, rendering and speed are not verified.
          </p>
          <dl className="pane mt-4 px-5 py-1 *:last:border-0">
            {EVIDENCE.map(([weight, name, rule]) => (
              <div key={name} className="grid grid-cols-[3rem_1fr] border-b py-3 text-sm">
                <dt className="contents">
                  <span className="text-muted-foreground">{weight}%</span>
                  <span className="font-medium">{name}</span>
                </dt>
                <dd className="col-start-2 text-muted-foreground">{rule}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Claims, stars, commits and passing tests don’t make a stage more certain. Two testers at
            35% make 58%, three make 73%. Each tester who could not get there takes 7% off.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">How the standings are ordered</h2>
          <p className="mt-2 text-muted-foreground">
            By score, so a lower claim that others have tested can rank above a higher one that
            nobody has. Equal scores go by evidence, then the claim, then stars. The official
            ranking has public code only. “With private” ranks everyone by the same rules, except
            that we may place one project first ourselves. It is marked, with the reason, and its
            score doesn’t change. The replay at the top of the standings shows claims over time.
          </p>
          <p className="mt-2 text-muted-foreground">
            “On GitHub since” is the day the repo was created. Without one on record, “First
            mentioned” is the earliest day in our own records that names the project. A project with
            no activity on record isn’t counted as inactive.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">How milestones are rated</h2>
          <p className="mt-2 text-muted-foreground">
            Stars measure how many points a project’s claim gained at once, next to its previous
            jump.
          </p>
          <dl className="pane mt-4 px-5 py-1 *:last:border-0">
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
          <dl className="pane mt-2 px-5 py-1 *:last:border-0">
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
