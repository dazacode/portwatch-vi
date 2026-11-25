import { describe, expect, it } from "vitest"
import {
  answerHtml,
  answerRobots,
  answerSitemap,
  DESCRIPTION,
  daysBetween,
  EARLIER,
  OFFICIAL,
  questions,
} from "@/lib/answer-page"
import { ANSWER, GOOGLE_TAG, googleTag } from "@/lib/site"

const data = {
  now: Date.parse("2026-11-25T10:00:00Z"),
  updated: "2026-11-25T07:39:20.591Z",
  projects: 30,
  furthest: "Runnable",
  leader: { name: "<b>Bad</b>", score: 64.5 },
}
const html = answerHtml(data)

describe("the answer page", () => {
  it("asks the question once as its heading and answers it in the HTML", () => {
    expect(html.match(/<h1>/g)).toHaveLength(1)
    expect(html).toContain("<h1>Is GTA 6 on PC?</h1>")
    expect(html).toContain('<p class="no">No.</p>')
    expect(html).toContain("6 days since the console release")
    expect(OFFICIAL.onPc).toBe(false)
  })

  it("is its own canonical page and can be indexed", () => {
    expect(html).toContain(`<link rel="canonical" href="${ANSWER.url}/">`)
    expect(html).not.toContain("noindex")
    expect(DESCRIPTION.length).toBeLessThan(160)
  })

  it("escapes what comes from projects", () => {
    expect(html).not.toContain("<b>Bad</b>")
  })

  it("has structured data that says only what the page shows", () => {
    const raw = html.split('ld+json">')[1].split("</script>")[0]
    const faq = JSON.parse(raw)["@graph"][1]
    expect(faq.mainEntity).toHaveLength(questions(data).length)
    for (const { name } of faq.mainEntity) expect(html).toContain(`<h3>${name}</h3>`)
  })

  it("counts days and keeps releases in order", () => {
    expect(daysBetween("2026-11-19", Date.parse("2026-11-19T23:00:00Z"))).toBe(0)
    for (const g of EARLIER) expect(daysBetween(g.console, g.pc)).toBeGreaterThan(0)
  })

  it("sets consent for Europe before Google's script is asked for", () => {
    const consent = googleTag.indexOf("'consent','default'")
    expect(consent).toBeGreaterThan(0)
    expect(consent).toBeLessThan(googleTag.indexOf("gtm.js"))
    for (const code of ["DE", "PL", "GB", "CH", "NO"]) expect(googleTag).toContain(`"${code}"`)
    expect(googleTag).not.toContain("</")
    expect(GOOGLE_TAG).toBeNull()
  })

  it("points crawlers at its own sitemap", () => {
    expect(answerRobots()).toContain(`${ANSWER.url}/sitemap.xml`)
    expect(answerSitemap(data.updated)).toContain(`<loc>${ANSWER.url}/</loc>`)
  })
})
