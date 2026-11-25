import { beat, parseBeat, presenceOn, type Watching, watching } from "@/lib/presence"

export const dynamic = "force-dynamic"

const cached = (seconds: number) => ({
  "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=30`,
})

// Read from the cache in front of it, so the store is asked a few times a minute at most.
export async function GET() {
  try {
    const now: Watching = await watching()
    return Response.json(now, { headers: cached(now.on ? 15 : 60) })
  } catch (err) {
    console.warn("watching:", err)
    return Response.json({ on: false } satisfies Watching, { headers: cached(30) })
  }
}

export async function POST(request: Request) {
  if (!presenceOn) return new Response(null, { status: 204 })
  // Only our own pages. Not a lock, and the count per address is limited as well.
  if (request.headers.get("sec-fetch-site") !== "same-origin")
    return new Response(null, { status: 403 })
  const text = await request.text()
  let body: unknown = null
  try {
    if (text.length <= 500) body = JSON.parse(text)
  } catch {}
  const parsed = parseBeat(body)
  if (!parsed) return new Response(null, { status: 400 })
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  try {
    return Response.json(
      { name: await beat(parsed, ip) },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.warn("watching:", err)
    return new Response(null, { status: 503 })
  }
}
