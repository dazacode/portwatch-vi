import { byNewest, getIntel, published, reportOf, sourceCount } from "@/lib/intel"

export const revalidate = 60

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

/** Published reports only. Held entries are on the site, not the API. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)))
  const before = url.searchParams.get("before")
  const project = url.searchParams.get("project")
  const kind = url.searchParams.get("kind")
  const file = await getIntel()
  let items = published(file).sort(byNewest)
  if (project) items = items.filter((i) => i.projectId === project)
  if (kind) items = items.filter((i) => i.kind === kind)
  if (before && Number.isFinite(Date.parse(before)))
    items = items.filter((i) => Date.parse(i.at) < Date.parse(before))
  const page = items.slice(0, limit)
  return Response.json(
    {
      version: 1,
      updated: file.updated,
      baselineAt: file.baselineAt,
      next: items.length > limit ? page.at(-1)?.at : null,
      items: page.map((item) => {
        const report = reportOf(file, item)
        return {
          id: item.id,
          url: `/intelligence/${item.id}`,
          title: item.title,
          oneLine: item.oneLine,
          kind: item.kind,
          project: item.projectId,
          at: item.at,
          status: item.status,
          confidence: item.confidence,
          sources: sourceCount(item),
          report: report
            ? {
                overview: report.overview,
                changed: report.changed,
                evidence: report.evidence,
                unknown: report.unknown,
              }
            : null,
          sourceList: item.sources.map((s) => ({
            outlet: s.outlet,
            title: s.title,
            url: s.url,
            kind: s.kind,
          })),
        }
      }),
    },
    { headers: CORS }
  )
}
