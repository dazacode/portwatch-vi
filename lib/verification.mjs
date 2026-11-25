// How sure we are that a project really reached a stage, from evidence other people produced.
// Shared by the site and the scripts. No dependencies.

export const STAGES = ["loads", "boots", "menu", "world", "playable"]
export const STAGE_POINTS = { loads: 10, boots: 20, menu: 30, world: 40, playable: 50 }
export const VERIFIED_AT = 0.7

/** Chance that one piece of evidence is enough alone. Claims and passing CI count for nothing. */
export const WEIGHTS = {
  challenge: 0.6, // live stream challenge, watched by a person
  tester: 0.35, // independent tester, report read in full
  contributor: 0.2, // tester whose code was merged into the project
  rule: 0.2, // independent tester, report matched by text rules only
}
const FAILURE = 0.93 // each tester who could not get there
const MAX_FAILURES = 6

const rank = (stage) => STAGES.indexOf(stage)

/** One voice per person: their best result, or their failure if they have no result. */
function voices(evidence, stage) {
  const best = new Map()
  let failures = new Set()
  for (const e of evidence) {
    if (e.outcome === "failed") {
      if (rank(e.stage) === rank(stage)) failures.add(e.by)
    } else if (rank(e.stage) >= rank(stage)) {
      best.set(e.by, Math.max(best.get(e.by) ?? 0, WEIGHTS[e.kind] ?? 0))
    }
  }
  failures = new Set([...failures].filter((by) => !best.has(by)))
  return { weights: [...best.values()], failures: failures.size }
}

/** 0 to 1 that the project reached this stage. Reaching a later stage counts for the earlier ones. */
export function confidence(evidence, stage) {
  const { weights, failures } = voices(evidence, stage)
  const sure = 1 - weights.reduce((left, w) => left * (1 - w), 1)
  return sure * FAILURE ** Math.min(failures, MAX_FAILURES)
}

/** The furthest stage reached with every stage before it verified too, and the points it is worth. */
export function verify(evidence, claimedScore) {
  const stages = STAGES.map((stage) => {
    const { weights, failures } = voices(evidence, stage)
    const c = confidence(evidence, stage)
    return { stage, confidence: c, people: weights.length, failures, verified: c >= VERIFIED_AT }
  })
  const firstGap = stages.findIndex((s) => !s.verified)
  const reached = firstGap === -1 ? STAGES.at(-1) : (STAGES[firstGap - 1] ?? null)
  return { stages, reached, score: reached ? Math.min(STAGE_POINTS[reached], claimedScore) : 0 }
}
