import { getBroadcast } from "@/lib/broadcast"

export const dynamic = "force-static"
export const revalidate = 15

export async function GET() {
  return Response.json(await getBroadcast())
}
