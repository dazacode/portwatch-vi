import { answerRobots } from "@/lib/answer-page"

export const dynamic = "force-static"

export const GET = () =>
  new Response(answerRobots(), { headers: { "Content-Type": "text/plain; charset=utf-8" } })
