import { Container } from "@/components/container"
import { Challenge } from "@/components/verify/challenge"
import { PAGES, pageMeta } from "@/lib/seo"
import { SITE } from "@/lib/site"
import { getEvidence, getStandings, getTracker } from "@/lib/tracker"

export const revalidate = 300
export const metadata = pageMeta(PAGES.verify)

export default async function Page() {
  const [tracker, evidence] = await Promise.all([getTracker(), getEvidence()])
  const projects = getStandings(tracker, evidence)
    .filter((s) => !s.nuked && s.steps[2] > 0)
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <Container className="pt-8">
      <div className="max-w-2xl space-y-10">
        <section>
          <h1 className="text-2xl font-semibold">Prove it live</h1>
          <p className="mt-2 text-muted-foreground">
            For projects that say they reach the menu or further. This is the only way to verify a
            build whose code isn’t public.
          </p>
          <ol className="pane mt-4 list-decimal space-y-2 py-4 pr-5 pl-10">
            <li>Go live somewhere that keeps the recording.</li>
            <li>
              Show the game and the terminal it was started from in one frame, with the build’s
              commit or version visible.
            </li>
            <li>Choose your project, and type its code on screen before it changes.</li>
            <li>Do the three actions in the game, in order, without cutting away.</li>
            <li>
              Submit the recording. A person watches it before anything counts. Passing on two
              different days verifies the stage.
            </li>
          </ol>
        </section>
        <Challenge projects={projects} issues={`https://github.com/${SITE.repo}/issues`} />
        <section>
          <h2 className="text-lg font-semibold">Testing someone else’s project</h2>
          <p className="mt-2 text-muted-foreground">
            Post a report in that project’s own issues. It is picked up by itself if it names the
            commit you ran, your graphics card and how far the game got, and your GitHub account is
            at least 90 days old.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">What this can’t rule out</h2>
          <p className="mt-2 text-muted-foreground">
            The game is out on consoles, so a determined person could stage a run with one. That is
            why a challenge needs the terminal in frame, counts for 60% and not for everything, and
            why several unrelated testers count for more. Never post game files, keys or links to
            them.
          </p>
        </section>
      </div>
    </Container>
  )
}
