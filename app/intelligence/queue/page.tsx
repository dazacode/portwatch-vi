import type { Metadata } from "next"
import Link from "next/link"
import { Breadcrumb } from "@/components/breadcrumb"
import { Container } from "@/components/container"
import { IntelCard } from "@/components/intel/card"
import { getIntel, queue } from "@/lib/intel"
import { pageMeta } from "@/lib/seo"

export const revalidate = 60

export const metadata: Metadata = {
  ...pageMeta({
    title: "Intelligence queue",
    description: "Held discoveries that have not cleared the confidence gate.",
    path: "/intelligence/queue",
  }),
  robots: { index: false, follow: true },
}

export default async function Page() {
  const file = await getIntel()
  const held = queue(file)
  const now = new Date().toISOString()
  return (
    <Container className="max-w-3xl pt-8">
      <Breadcrumb
        parent={{ name: "News", path: "/news" }}
        page={{ name: "Queue", path: "/intelligence/queue" }}
      />
      <h1 className="text-2xl font-semibold">Queue</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {held.length} held. Each has a reason. The desk model and a person can both work it; the
        commands are in <code className="text-xs">docs/INTEL-DESK.md</code>. Nothing here is in a
        feed.
      </p>
      <div className="mt-6">
        {held.length === 0 ? (
          <p className="pane px-5 py-6 text-sm text-muted-foreground">Nothing held.</p>
        ) : (
          held.map((item) => (
            <div key={item.id}>
              <IntelCard item={item} now={now} />
              {item.heldReasons?.length ? (
                <p className="mb-3 -mt-2 text-xs text-muted-foreground">
                  Held: {item.heldReasons.join("; ")}.
                </p>
              ) : null}
              <pre className="mb-4 overflow-x-auto rounded-md border bg-muted/40 p-2 text-xs">
                ./pw intel publish {item.id} --note "checked"
              </pre>
            </div>
          ))
        )}
      </div>
      <p className="mt-8 text-sm">
        <Link href="/news?show=reports" className="underline underline-offset-4">
          Back to the reports
        </Link>
      </p>
    </Container>
  )
}
