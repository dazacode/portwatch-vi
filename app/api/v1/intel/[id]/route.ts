import { getIntel, reportOf } from "@/lib/intel"

export const dynamic = "force-static"
export const revalidate = 60

export async function generateStaticParams() {
  return (await getIntel()).items.filter((i) => i.status === "published").map(({ id }) => ({ id }))
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = await getIntel()
  const item = file.items.find((i) => i.id === id)
  if (!item) return Response.json({ error: "not_found" }, { status: 404, headers: CORS })
  const report = reportOf(file, item)
  return Response.json(
    {
      version: 1,
      item: {
        ...item,
        report: report ?? null,
        sourceList: item.sources,
      },
    },
    { headers: CORS }
  )
}
