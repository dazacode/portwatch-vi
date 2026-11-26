import { CLAIM_SHARE, shareOf } from "@/lib/rating.mjs"
import type { Ours } from "@/lib/score-colors"
import { stageLabel } from "@/lib/stages.mjs"
import type { Evidence } from "@/lib/tracker"
import { STAGE_POINTS, STAGES, verify } from "@/lib/verification.mjs"

const round = (n: number) => Math.round(n * 10) / 10
// Enough for a bar's width, and small to send.
const fine = (n: number) => Math.round(n * 100) / 100
const POINTS: Record<string, number> = STAGE_POINTS
const PLAYABLE = POINTS.playable

/**
 * Our score as it stood when a project claimed `claim`, with only the reports filed by then. The same
 * sum as rate() in lib/rating.mjs: each stage counts by how sure others had made us of it, and
 * everything past Runnable counts half. Only the split of that last part between its tracks is
 * unknown for the past, so it follows today's.
 */
export function scoreAt(
  claim: number,
  evidence: Pick<Evidence, "kind" | "outcome" | "stage" | "by">[],
  today: Ours["parts"]
): Ours {
  const { stages } = verify(evidence, claim)
  const ladder = Math.min(claim, PLAYABLE)
  const parts: Ours["parts"] = STAGES.flatMap((key, i) => {
    const floor = i === 0 ? 0 : POINTS[STAGES[i - 1]]
    const max = POINTS[key] - floor
    const claimed = Math.min(max, Math.max(0, ladder - floor))
    if (!claimed) return []
    // Below the first stage it is groundwork, and nobody can see that run.
    const groundwork = i === 0 && claimed < max
    const confidence = groundwork ? 0 : stages[i].confidence
    const k = groundwork ? "groundwork" : key
    return [{ key: k, label: stageLabel(k), claimed, counted: claimed * shareOf(confidence) }]
  })
  if (claim > PLAYABLE) {
    const left = claim - PLAYABLE
    const now = today.filter((p) => p.key !== "groundwork" && !STAGES.includes(p.key))
    const total = now.reduce((sum, p) => sum + p.claimed, 0)
    const split = total > 0 ? now : [{ key: "manual", label: "Past runnable", claimed: 1 }]
    const whole = total > 0 ? total : 1
    for (const p of split) {
      const claimed = (p.claimed / whole) * left
      parts.push({
        key: p.key,
        label: p.label,
        claimed,
        counted: claimed * CLAIM_SHARE,
      })
    }
  }
  return {
    rating: round(parts.reduce((sum, p) => sum + p.counted, 0)),
    parts: parts.map((p) => ({ ...p, claimed: fine(p.claimed), counted: fine(p.counted) })),
  }
}
