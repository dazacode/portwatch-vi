// Our stages on top of upstream's scale (lib/scoring.mjs, a copy that must stay theirs). Upstream calls
// a build Playable as soon as a character can be moved, even at 3 fps. We call that Runnable, and keep
// Playable for what a console does. A goal adds no points: speed, picture and story already have them.
// Shared by the site and the scripts. No other dependencies.
import { MILESTONES, scoreEffort, trackStep, trackValues } from "./scoring.mjs"

/** The slow end of what a console holds. 30 is the target. */
export const BASELINE_FPS = 20
/** "Close to the console, minor glitches" on the rendering steps. */
export const CLEAN_RENDER = 0.75
/** "Main story to the credits" on the story steps. */
export const CREDITS = 0.85

const CHECKS = {
  fps: {
    label: `${BASELINE_FPS} fps or better, on a named PC`,
    ok: (gta) => Number(gta.fps) >= BASELINE_FPS,
    now: (gta) => (Number(gta.fps) > 0 ? `${gta.fps} fps` : "Not measured"),
  },
  render: {
    label: "Textures and lighting close to the console, without major artifacts",
    ok: (gta) => trackValues(gta).render >= CLEAN_RENDER,
    now: (gta) => (Number(gta.render) > 0 ? trackStep("render", gta.render).label : "Not measured"),
  },
  story: {
    label: "The main story, to the credits",
    ok: (gta) => trackValues(gta).story >= CREDITS,
    now: (gta) => trackStep("story", gta.story).label,
  },
}

export const PROOF_KEYS = Object.keys(CHECKS)

export const GOALS = [
  {
    key: "smooth",
    label: "Playable",
    desc: `Runs at ${BASELINE_FPS} to 30 fps, the console baseline, without major texture or lighting artifacts. Evidence is needed for both.`,
    needs: ["fps", "render"],
  },
  {
    key: "beaten",
    label: "Story beaten",
    desc: "The main story is finished at that speed and with that picture. Evidence is needed for all three.",
    needs: ["fps", "render", "story"],
  },
]

const RENAMED = {
  playable: {
    label: "Runnable",
    desc: "You control a character in the world, at any speed and however it looks. PortWatch calls this Playable.",
  },
}

/** Upstream's steps under our names. The keys and the points are theirs. */
export const STEPS = MILESTONES.map((m) => ({ ...m, ...RENAMED[m.key] }))

/** Every stage in order, with our goals before the last one. */
export const STAGE_ORDER = [...STEPS.slice(0, -1), ...GOALS, ...STEPS.slice(-1)].map(
  ({ key, label }) => ({ key, label })
)

export const stageLabel = (key) => STAGE_ORDER.find((s) => s.key === key)?.label ?? key
export const stageRank = (key) => STAGE_ORDER.findIndex((s) => s.key === key)
export const isGoal = (key) => GOALS.some((g) => g.key === key)

const link = (url) => (typeof url === "string" && url.startsWith("https://") ? url : null)

/** What each goal needs, where the project is, and the evidence. A claim without a link is not met. */
export function goalsOf(effort) {
  const gta = effort.gta ?? {}
  const { playable } = scoreEffort(effort)
  return GOALS.map(({ key, label, desc, needs }) => {
    const checks = needs.map((need) => {
      const { label: what, ok, now } = CHECKS[need]
      const claimed = playable && ok(gta)
      const url = link(effort.goalProof?.[need])
      return { key: need, label: what, now: now(gta), claimed, url, met: claimed && url !== null }
    })
    return { key, label, desc, checks, met: checks.every((c) => c.met) }
  })
}

/** The furthest stage by our rules. Complete needs both goals too. */
export function stageOf(effort) {
  const { reached } = scoreEffort(effort)
  if (reached !== "playable" && reached !== "complete") return reached
  const goals = goalsOf(effort)
  if (reached === "complete" && goals.every((g) => g.met)) return reached
  return goals.findLast((g) => g.met)?.key ?? "playable"
}
