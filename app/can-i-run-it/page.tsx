import { Container } from "@/components/container"
import { Checker } from "@/components/pc-check/checker"
import { GPUS as BOARD_GPUS, type Gpu, gpusOf } from "@/lib/gpu"
import { CHECKED, CONSOLES, SOURCES, TIERS } from "@/lib/pc-check"
import { PAGES, pageMeta } from "@/lib/seo"
import { getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata = pageMeta(PAGES.canItRun)

const VERSIONS = TIERS.filter((t) => t.id !== "beyond")
const CHECKED_ON = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
  new Date(CHECKED)
)

export default async function Page() {
  const tracker = await getTracker()
  const live = tracker.efforts.filter((e) => !e.nuked)
  const builds = Object.fromEntries(
    BOARD_GPUS.map((g) => [g, live.filter((e) => gpusOf(e.gpu).includes(g)).length])
  ) as Record<Gpu, number>

  return (
    <Container className="pt-8 pb-12">
      <div className="max-w-3xl space-y-10">
        <section>
          <h1 className="text-2xl font-semibold">Can my PC run GTA VI?</h1>
          <p className="mt-2 text-muted-foreground">
            GTA VI is out on PS5 and Xbox Series X|S. There is no PC version yet: Rockstar hasn’t
            announced one or said what it will need, and a report of early 2027 is unconfirmed. So
            this compares your parts with the consoles the game runs on, from benchmarks, and tells
            you which console’s version your PC is closest to.
          </p>
        </section>

        <Checker builds={builds} />

        <section>
          <h2 className="text-lg font-semibold">What each console runs</h2>
          <p className="mt-2 text-muted-foreground">
            Every console aims for 30 fps, and none has a 60 fps mode. Rockstar says even the PS5
            Pro’s processor can’t run the game’s simulation any faster. PS5 and Series X run the
            same version; Digital Foundry found each a little ahead in different scenes.
          </p>
          <div className="pane mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Version
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Renders
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Shown at
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Frame rate
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Ray tracing
                  </th>
                </tr>
              </thead>
              <tbody className="align-top">
                {VERSIONS.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      {t.versions}
                    </th>
                    <td className="px-4 py-3">{t.renders}</td>
                    <td className="px-4 py-3">{t.shown}</td>
                    <td className="px-4 py-3">{t.fps}</td>
                    <td className="px-4 py-3">{t.rayTracing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pane mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Console
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Processor
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Graphics
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Memory
                  </th>
                </tr>
              </thead>
              <tbody className="align-top">
                {CONSOLES.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      {c.name}
                    </th>
                    <td className="px-4 py-3">{c.cpu}</td>
                    <td className="px-4 py-3">{c.gpu}</td>
                    <td className="px-4 py-3">{c.memory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">How this compares</h2>
          <div className="mt-2 space-y-3 text-muted-foreground">
            <p>
              Graphics cards are ranked by benchmarks: Tom’s Hardware’s GPU hierarchy, the mean of
              its 1080p and 1440p results. A PS5 sits between an RTX 2070 Super and an RX 6700, the
              two cards Digital Foundry uses to stand in for it. A PS5 Pro sits next to an RX 9060
              XT 16GB, which Digital Foundry found about as fast.
            </p>
            <p>
              TFLOPS are shown but never used. AMD’s RX 7000 and 9000 cards and NVIDIA’s since the
              RTX 30 series count two operations a cycle that games seldom get, so the number runs
              well ahead of the speed. An RX 7600 lists 21.8 TFLOPS against a PS5’s 10.3, and plays
              at about the same speed.
            </p>
            <p>
              Processors are ranked on TechPowerUp’s game tests at low resolution, where the
              processor is what limits. Tested as a PC part, the Xbox Series X processor came out
              about a quarter slower than a Ryzen 5 3600. A PC gives some of that back to Windows
              and drivers, and has no chip to unpack game data, so a 3600 is the mark we use for a
              console.
            </p>
            <p>
              A part matches at 95% of a console, because benchmark suites disagree by about that
              much, and is close at 80%. Going past the consoles needs about twice a PS5 in both
              parts; that line is our estimate. Macs are compared on their graphics on paper, as
              there is no Mac version. Only desktop parts are listed: a laptop chip with the same
              name is usually slower.
            </p>
            <p>
              The graphics are detected from what your browser reports to web pages, and that stays
              in your browser. Browsers don’t report the processor or how much memory there is, and
              Safari and Firefox hide or blur the graphics too, so those are for you to choose.
            </p>
            <p>Checked on {CHECKED_ON}.</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Sources</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Container>
  )
}
