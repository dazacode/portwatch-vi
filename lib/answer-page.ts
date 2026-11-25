import { utcDay, utcTime } from "@/lib/format"
import { toJsonLd } from "@/lib/seo"
import { ANSWER, SITE } from "@/lib/site"

/** What Rockstar and Take-Two have said. Change it only with a source, and move the date when it is read again. */
export const OFFICIAL = {
  onPc: false,
  checkedAt: "2026-11-25",
  launchedAt: "2026-11-19",
  sources: [
    {
      name: "Take-Two: Grand Theft Auto VI now available (PS5 and Xbox Series X|S)",
      url: "https://www.take2games.com/ir/news/rockstar-games-announces-grand-theft-auto-vi-now-available",
    },
    {
      name: "Rockstar Games: the Grand Theft Auto VI page",
      url: "https://www.rockstargames.com/VI",
    },
  ],
} as const

/** Console and PC release days of Rockstar's earlier games. History, not a forecast. */
export const EARLIER = [
  { game: "Grand Theft Auto IV", console: "2008-04-29", pc: "2008-12-02" },
  { game: "Grand Theft Auto V", console: "2013-09-17", pc: "2015-04-14" },
  { game: "Red Dead Redemption 2", console: "2018-10-26", pc: "2019-11-05" },
]

export const daysBetween = (from: string, to: string | number) =>
  Math.floor((new Date(to).getTime() - Date.parse(from)) / 864e5)

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export type AnswerData = {
  now: number
  /** When the tracker's data was last read. */
  updated: string
  projects: number
  furthest: string
  leader: { name: string; score: number } | null
}

export const TITLE = "Is GTA 6 on PC? No, not yet"
export const DESCRIPTION =
  "No. GTA 6 is out on PS5 and Xbox Series X|S only. Rockstar has not announced a PC version or a PC release date. Checked against the official pages."

/** The questions printed on the page, which is also all the structured data says. */
export const questions = (d: AnswerData) => [
  {
    q: "Is GTA 6 coming to PC?",
    a: "Probably, but nothing is official. Rockstar and Take-Two have not announced a PC version. Earlier Rockstar games did come to PC, months after the consoles.",
  },
  {
    q: "When is the GTA 6 PC release date?",
    a: "There isn’t one. Any exact date you see is a guess or a rumour until Rockstar announces it.",
  },
  {
    q: "What can I play GTA 6 on?",
    a: "PlayStation 5 and Xbox Series X|S, since 19 November 2026.",
  },
  {
    q: "Is there a GTA 6 PC download?",
    a: "No official one. Sites, videos and messages offering a GTA 6 PC download are a common scam. This site hosts and links to no game files.",
  },
  {
    q: "Can anyone run GTA 6 on a PC at all?",
    a: `Not in a way you would want to play. ${d.projects} unofficial community projects are trying. The furthest stage any of them claims is “${d.furthest.toLowerCase()}”, at a few frames per second, and most claims are unverified.`,
  },
]

/** utcDay leaves the year out, and these span decades. */
const fullDay = (day: string) =>
  new Date(day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

const month = (days: number) => Math.round(days / 30.44)

export function answerHtml(d: AnswerData) {
  const days = daysBetween(OFFICIAL.launchedAt, d.now)
  const faq = questions(d)
  const e = escapeHtml
  const ld = {
    "@graph": [
      {
        "@type": "WebSite",
        name: ANSWER.name,
        alternateName: ANSWER.host,
        url: `${ANSWER.url}/`,
        inLanguage: "en",
      },
      {
        "@type": "FAQPage",
        name: TITLE,
        description: DESCRIPTION,
        url: `${ANSWER.url}/`,
        dateModified: d.updated,
        inLanguage: "en",
        mainEntity: faq.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(TITLE)}</title>
<meta name="description" content="${e(DESCRIPTION)}">
<link rel="canonical" href="${ANSWER.url}/">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${e(ANSWER.name)}">
<meta property="og:title" content="${e(TITLE)}">
<meta property="og:description" content="${e(DESCRIPTION)}">
<meta property="og:url" content="${ANSWER.url}/">
<meta property="og:image" content="${ANSWER.url}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#120c21">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<script type="application/ld+json">${toJsonLd(ld)}</script>
<style>
*{box-sizing:border-box}
body{margin:0;background:#120c21;color:#fff3f6;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main,footer{max-width:44rem;margin:0 auto;padding:0 1.25rem}
.top{min-height:72svh;display:flex;flex-direction:column;justify-content:center;text-align:center;padding:3rem 0}
h1{font-size:clamp(1.6rem,6vw,2.75rem);line-height:1.15;margin:0;letter-spacing:-.02em}
.no{font-size:clamp(5.5rem,30vw,14rem);line-height:1;font-weight:900;margin:.1em 0;color:#ff9ad6;text-shadow:0 0 .08em #ff4fa8,0 0 .35em #ff3d9a88}
.lead{font-size:1.2rem;margin:0 auto;max-width:32rem}
.days{color:#ffb454;font-weight:700;margin:1rem 0 0}
.meta{color:#c9b9d6;font-size:.9rem;margin:.5rem 0 0}
h2{font-size:1.35rem;line-height:1.25;margin:2.5rem 0 .5rem}
h3{font-size:1.05rem;margin:1.5rem 0 .25rem}
p{margin:.25rem 0 1rem}
a{color:#4fd8d8}
table{width:100%;border-collapse:collapse;font-size:.95rem}
th,td{text-align:left;padding:.5rem .5rem .5rem 0;border-bottom:1px solid #3a2a55}
footer{margin-top:3rem;padding-top:1.5rem;padding-bottom:3rem;border-top:2px solid #ff3d8b;color:#c9b9d6;font-size:.9rem}
</style>
</head>
<body>
<main>
<div class="top">
<h1>Is GTA 6 on PC?</h1>
<p class="no">No.</p>
<p class="lead">GTA 6 is out on PS5 and Xbox Series X|S only. Rockstar has not announced a PC version or a PC release date.</p>
<p class="days">${days} ${days === 1 ? "day" : "days"} since the console release</p>
<p class="meta">Official pages last checked <time datetime="${OFFICIAL.checkedAt}">${fullDay(OFFICIAL.checkedAt)}</time>. Unofficial fan site.</p>
</div>

<h2>Where that comes from</h2>
<p>Take-Two announced the game for PlayStation 5 and Xbox Series X|S on 19 November 2026. Neither that announcement nor Rockstar’s own page for the game lists a PC version.</p>
<ul>
${OFFICIAL.sources.map((s) => `<li><a href="${e(s.url)}">${e(s.name)}</a></li>`).join("\n")}
</ul>

<h2>How long did earlier Rockstar games take to reach PC?</h2>
<p>This is history, not a forecast for GTA 6.</p>
<table>
<thead><tr><th scope="col">Game</th><th scope="col">Consoles</th><th scope="col">PC</th><th scope="col">Wait</th></tr></thead>
<tbody>
${EARLIER.map((g) => `<tr><td>${g.game}</td><td>${fullDay(g.console)}</td><td>${fullDay(g.pc)}</td><td>${month(daysBetween(g.console, g.pc))} months</td></tr>`).join("\n")}
</tbody>
</table>

<h2>Unofficial: who is trying to run it on PC?</h2>
<p>${d.projects} community projects are trying to run the console version on a PC. The furthest stage any of them claims is “${e(d.furthest.toLowerCase())}”${d.leader ? `, and ${e(d.leader.name)} claims the most at ${d.leader.score}%` : ""}. None of this is a PC release. <a href="${SITE.url}/standings">${SITE.name} ranks them and checks their claims</a>, with <a href="${SITE.url}">live streams and news</a>.</p>
<p class="meta">Project data read <time datetime="${e(d.updated)}">${utcDay(d.updated)}, ${utcTime(d.updated)}</time>.</p>

<h2>Questions</h2>
${faq.map(({ q, a }) => `<h3>${e(q)}</h3>\n<p>${e(a)}</p>`).join("\n")}
</main>
<footer>
<p>Unofficial fan site, not affiliated with Rockstar Games, Take-Two or Microsoft. Grand Theft Auto and GTA are their owners’ trademarks. Nothing here hosts or links to game files.</p>
<p>From the people behind <a href="${SITE.url}">${SITE.name}</a>.</p>
</footer>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`
}

export const answerRobots = () => `User-agent: *\nAllow: /\n\nSitemap: ${ANSWER.url}/sitemap.xml\n`

export const answerSitemap = (updated: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${ANSWER.url}/</loc><lastmod>${new Date(updated).toISOString()}</lastmod></url>
</urlset>
`
