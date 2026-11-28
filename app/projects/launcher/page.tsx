import { ArrowUpRight, Download, Star } from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import { Container } from "@/components/container"
import { JsonLd } from "@/components/json-ld"
import { Wordmark } from "@/components/wordmark"
import { PAGES, pageMeta, pageUrl } from "@/lib/seo"
import { getTracker } from "@/lib/tracker"

// VILauncher is ours, so this address is its page, not an entry on the board. A static folder wins over
// [id], and nothing on the board uses the id "launcher".
export const revalidate = 3600

const REPO = "dazacode/vilauncher"
const GITHUB = `https://github.com/${REPO}`
const LATEST = `${GITHUB}/releases/latest`

const META = PAGES.launcher

export const metadata: Metadata = pageMeta({
  ...META,
  image: { url: "/launcher/banner.png", width: 1280, height: 400, alt: "VILauncher by VIPortLive" },
})

type Release = { tag: string; at: string; assets: { name: string; url: string }[] }

/** The newest release and the star count, from GitHub. Without them the page links to the release page. */
async function getRepo(): Promise<{ stars: number | null; release: Release | null }> {
  const get = (path: string) =>
    fetch(`https://api.github.com/repos/${REPO}${path}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate },
    }).then((r) => (r.ok ? r.json() : null))
  try {
    const [repo, latest] = await Promise.all([get(""), get("/releases/latest")])
    return {
      stars: typeof repo?.stargazers_count === "number" ? repo.stargazers_count : null,
      release: latest?.tag_name
        ? {
            tag: latest.tag_name,
            at: latest.published_at,
            assets: (latest.assets ?? []).map(
              (a: { name: string; browser_download_url: string }) => ({
                name: a.name,
                url: a.browser_download_url,
              })
            ),
          }
        : null,
    }
  } catch {
    return { stars: null, release: null }
  }
}

const PLATFORMS = [
  { os: "Windows", file: "Installer", match: /x64-setup\.exe$/ },
  { os: "Windows", file: "Portable .exe", match: /^VILauncher\.exe$/ },
  { os: "macOS", file: "Universal .dmg", match: /\.dmg$/ },
  { os: "Linux", file: "AppImage", match: /\.AppImage$/ },
  { os: "Linux", file: ".deb", match: /\.deb$/ },
]

const FEATURES = [
  {
    title: "Every project on the board",
    text: "The library is VIPortLive's list, live: frame rates, the graphics cards each build was made for, and what we've verified. Projects that were taken down stay hidden.",
  },
  {
    title: "Knows your PC",
    text: "It reads your graphics card, memory and processor and warns you when a build needs more than you have, from what its author reported.",
  },
  {
    title: "Sets up the tools for you",
    text: "Git, Rust and the C++ build tools are found or installed: with winget on Windows, Apple's installer on macOS. You approve each one.",
  },
  {
    title: "One click to play",
    text: "Downloaded and built once, then kept. Updates show a warning first, save your edits as a patch and keep the last build for a one-step rollback.",
  },
  {
    title: "Fixes known problems",
    text: "Before you play it checks the project's own notes for known problems: missing Agility SDK files, stale caches, out-of-memory crashes. It fixes what it can and checks the result.",
  },
  {
    title: "Your saves are safe",
    text: "Continue, start fresh, copy a save from another build or start at a checkpoint. Updates, rollbacks and cache clears never touch them.",
  },
  {
    title: "Shader warm-up",
    text: "Builds the shader cache before the first launch where a project supports it, so the first minutes don't stutter.",
  },
  {
    title: "Report a problem in one click",
    text: "After a failed job it opens a GitHub issue with the log filled in, names and folders removed. Nothing is sent until you submit.",
  },
  {
    title: "Free and open source",
    text: "GPL-3.0. Read every line, build it yourself, or fork it. A SHA-256 checksum for every download.",
  },
]

const STEPS = [
  { n: "1", title: "Download", text: "Pick your system below. No account, no sign-up." },
  { n: "2", title: "Pick a project", text: "Browse the board inside the app and press Set up." },
  {
    n: "3",
    title: "Play",
    text: "Point it at your own game files once. After that it's one button.",
  },
]

const fmt = new Intl.NumberFormat("en-US")
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso))

function Downloads({ release }: { release: Release | null }) {
  const found = PLATFORMS.flatMap((p) => {
    const asset = release?.assets.find((a) => p.match.test(a.name))
    return asset ? [{ ...p, url: asset.url }] : []
  })
  if (found.length === 0)
    return (
      <a
        href={LATEST}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-14 items-center gap-2 rounded-full bg-primary px-7 text-lg font-semibold text-primary-foreground shadow-[0_0_40px_-8px_var(--stripe-1)] transition-colors hover:bg-primary/85"
      >
        <Download aria-hidden="true" className="size-5" />
        Download VILauncher
      </a>
    )
  const [first, ...rest] = found
  return (
    <div className="flex flex-col items-center gap-4">
      <a
        href={first.url}
        className="inline-flex h-14 items-center gap-2.5 rounded-full bg-primary px-7 text-lg font-semibold text-primary-foreground shadow-[0_0_40px_-8px_var(--stripe-1)] transition-colors hover:bg-primary/85"
      >
        <Download aria-hidden="true" className="size-5" />
        Download for {first.os}
        <span className="text-sm font-normal opacity-80">{first.file}</span>
      </a>
      <ul className="flex flex-wrap justify-center gap-2">
        {rest.map((p) => (
          <li key={p.url}>
            <a
              href={p.url}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-(--pane) px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              {p.os} <span className="text-muted-foreground">{p.file}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function Page() {
  const [{ stars, release }, tracker] = await Promise.all([getRepo(), getTracker()])
  const projects = tracker.efforts.filter((e) => !e.nuked).length

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "VILauncher",
          description: META.description,
          url: pageUrl(META.path),
          applicationCategory: "GameApplication",
          operatingSystem: "Windows, macOS, Linux",
          license: "https://www.gnu.org/licenses/gpl-3.0.html",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          ...(release && { softwareVersion: release.tag.replace(/^v/, "") }),
          publisher: { "@type": "Organization", name: "VIPortLive", url: pageUrl("/") },
          sameAs: GITHUB,
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,color-mix(in_oklch,var(--stripe-1)_32%,transparent),transparent)]"
        />
        <Container className="relative flex flex-col items-center pt-14 pb-12 text-center sm:pt-20">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Made by <Wordmark className="text-base text-foreground" />
          </p>
          <Image
            src="/launcher/icon-1024.png"
            alt=""
            width={112}
            height={112}
            fetchPriority="high"
            className="mt-8 size-24 rounded-[1.75rem] shadow-[0_0_60px_-10px_var(--stripe-1)] sm:size-28"
          />
          <h1
            translate="no"
            className="mt-6 inline-flex items-baseline text-6xl leading-none sm:text-8xl"
          >
            <span className="font-extrabold tracking-tight">VI</span>
            <span className="ml-1 font-script text-[1.15em] text-primary">Launcher</span>
          </h1>
          <p className="mt-6 max-w-2xl text-xl text-balance sm:text-2xl">
            Every community GTA VI project on our board, installed, updated and started from one
            app.
          </p>
          <p className="mt-3 max-w-xl text-balance text-muted-foreground">
            Free and open source for Windows, macOS and Linux. You bring your own game. Nothing is
            included or downloaded.
          </p>

          <div className="mt-10">
            <Downloads release={release} />
          </div>

          <dl className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {release && (
              <div className="flex gap-1.5">
                <dt>Version</dt>
                <dd className="font-medium text-foreground">
                  {release.tag}, {day(release.at)}
                </dd>
              </div>
            )}
            {stars !== null && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Stars on GitHub</dt>
                <Star aria-hidden="true" className="size-4 fill-current text-stripe-2" />
                <dd className="font-medium text-foreground">{fmt.format(stars)}</dd>
                <span aria-hidden="true">stars</span>
              </div>
            )}
            <div className="flex gap-1.5">
              <dt>Projects in the library</dt>
              <dd className="font-medium text-foreground">{projects}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Price</dt>
              <dd className="font-medium text-foreground">Free</dd>
            </div>
          </dl>
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1 text-sm underline underline-offset-4 hover:text-primary"
          >
            Code, release notes and checksums on GitHub
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </Container>
      </section>

      {/* The app */}
      <Container>
        <figure className="relative mx-auto max-w-5xl">
          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-[2rem] bg-linear-to-r from-stripe-1 via-stripe-2 to-stripe-3 opacity-25 blur-3xl"
          />
          <Image
            src="/launcher/library.png"
            alt="VILauncher's library: Belobug selected, with its frame rate, the cards it was made for, a Play button and how it fits your PC"
            width={1400}
            height={900}
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="w-full rounded-2xl border shadow-2xl"
          />
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">
            Example data from the app's demo mode.
          </figcaption>
        </figure>
      </Container>

      {/* Three steps */}
      <Container className="mt-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          From nothing to playing in three steps
        </h2>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="pane p-6">
              <span className="font-script text-4xl text-primary" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>

      {/* Features */}
      <Container className="mt-20">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Everything the projects don't do for you
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Each build has its own readme, its own tools and its own way to break. VILauncher handles
          all of it the same way.
        </p>
        <ul className="mx-auto mt-10 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="pane p-6">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </li>
          ))}
        </ul>
      </Container>

      {/* Set up */}
      <Container className="mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Built on the board you already read</h2>
            <p className="mt-4 text-muted-foreground">
              VILauncher reads the same list as this site, so the scores, frame rates and takedowns
              you see here are what the app shows. When a project is verified on VIPortLive, the app
              says so.
            </p>
            <p className="mt-3 text-muted-foreground">
              Your own Git repos, prebuilt ZIPs and builds already on your PC can be added and
              managed the same way.
            </p>
          </div>
          <Image
            src="/launcher/first-setup.png"
            alt="A project that isn't installed yet, with its Set up button"
            width={1400}
            height={900}
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="w-full rounded-2xl border shadow-xl"
          />
        </div>
      </Container>

      {/* Last call */}
      <Container className="mt-24 mb-16">
        <div className="pane relative mx-auto max-w-4xl overflow-hidden px-6 py-14 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_100%,color-mix(in_oklch,var(--stripe-1)_25%,transparent),transparent)]"
          />
          <div className="relative">
            <h2 className="text-3xl font-bold text-balance sm:text-4xl">
              Built for you, download
            </h2>
            <div className="mt-8">
              <Downloads release={release} />
            </div>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground">
          VILauncher ships no game files and downloads none: you need your own copy of any game a
          project uses. It manages projects made by other people and does not vouch for their code.
          It is not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Forked
          from Mandyhub by Zettrox. GPL-3.0-or-later.
        </p>
      </Container>
    </>
  )
}
