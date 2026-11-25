// Our own score: what a project claims, discounted by how little of it anyone else has seen.
// The claim is upstream's scale (lib/scoring.mjs). The evidence is ours (lib/verification.mjs).
// Shared by the site and the tests. No other dependencies.
import { STABILITY, scoreEffort, stabilityKey, TRACKS, trackStep } from "./scoring.mjs"
import { stageLabel } from "./stages.mjs"
import { STAGE_POINTS, STAGES, VERIFIED_AT } from "./verification.mjs"

/** The share of a claim that counts with no evidence at all. */
export const CLAIM_SHARE = 0.5

const PLAYABLE = STAGE_POINTS.playable
const round = (n) => Math.round(n * 10) / 10

/** 0.5 with no evidence, rising in a straight line to 1 once a stage is verified. */
export const shareOf = (confidence) =>
  CLAIM_SHARE + (1 - CLAIM_SHARE) * Math.min(1, confidence / VERIFIED_AT)

function trackNote(key, gta) {
  if (key === "perf") return gta.fps ? `${gta.fps} fps` : null
  if (key === "stability") {
    const label = stabilityKey(gta.stability)
    return label === "unknown" ? null : STABILITY[label].label
  }
  return trackStep(key, gta[key])?.label ?? null
}

/**
 * Every part says what is claimed and what counts. A note of null means it was never measured, which
 * earns nothing but isn't reported as a bad result.
 * `stages` is what verify() returns, one entry for each stage in order.
 */
export function rate(effort, stages) {
  const s = scoreEffort(effort)
  const gta = effort.gta ?? {}
  const ladder = Math.min(s.score, PLAYABLE)

  const parts = STAGES.flatMap((key, i) => {
    const floor = i === 0 ? 0 : STAGE_POINTS[STAGES[i - 1]]
    const max = STAGE_POINTS[key] - floor
    const claimed = Math.min(max, Math.max(0, ladder - floor))
    if (!claimed) return []
    // Below the first stage it is groundwork, and nobody can see that run.
    const groundwork = i === 0 && claimed < max && !(Number(gta.loads) > 0)
    const confidence = groundwork ? 0 : stages[i].confidence
    return [
      {
        key: groundwork ? "groundwork" : key,
        label: stageLabel(groundwork ? "groundwork" : key),
        claimed,
        counted: claimed * shareOf(confidence),
        max,
        note: "",
      },
    ]
  })

  if (s.playable) {
    const left = 100 - PLAYABLE
    const quality = Number.isFinite(effort.manualScore)
      ? [
          {
            key: "manual",
            label: "Past runnable",
            claimed: Math.max(0, s.score - PLAYABLE),
            max: left,
            note: "",
          },
        ]
      : TRACKS.map((t) => ({
          key: t.key,
          label: t.label,
          claimed: t.weight * s.tracks[t.key] * left,
          max: t.weight * left,
          note: trackNote(t.key, gta),
        }))
    // No report can confirm these yet, so all of them count as claims.
    parts.push(...quality.map((q) => ({ ...q, counted: q.claimed * CLAIM_SHARE })))
  }

  return { score: round(parts.reduce((sum, p) => sum + p.counted, 0)), parts }
}
