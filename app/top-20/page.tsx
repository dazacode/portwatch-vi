import type { Metadata } from "next"
import { Container } from "@/components/container"

export const revalidate = 300

export const metadata: Metadata = {
  title: "GTA VI on PC: the top 20 builds",
  description:
    "How far GTA VI runs on PC, all fan builds combined, and the top 20 by our score. Updated with the board.",
  openGraph: { images: [{ url: "/top-20/image", width: 1080, height: 1350 }] },
  twitter: { card: "summary_large_image", images: ["/top-20/image"] },
}

export default function Page() {
  return (
    <Container className="pt-8 pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">The top 20, as a picture</h1>
        <a
          href="/top-20/image"
          download="gta-vi-pc-top-20.png"
          className="rounded-full border px-4 py-1.5 text-sm hover:bg-foreground/5"
        >
          Download PNG
        </a>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Made from the board, and updated with it. Share it as it is.
      </p>
      {/* biome-ignore lint/performance/noImgElement: a generated PNG, shown at its own size */}
      <img
        src="/top-20/image"
        alt="GTA VI on PC: how far it runs, all builds combined, and the top 20 builds by our score"
        width={1080}
        height={1350}
        className="mt-6 h-auto w-full max-w-[540px] rounded-2xl shadow-xl"
      />
    </Container>
  )
}
