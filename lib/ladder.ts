import { GOALS, STEPS } from "@/lib/stages.mjs"

// Kept apart from lib/tracker, which carries the data files: the ladder is drawn in the browser too.
export const LADDER = STEPS.filter((m) => m.key !== "groundwork" && m.key !== "complete")
/** The ladder and our goals after it: what the bars show, so a slow build doesn't look finished. */
export const ROAD: { key: string; label: string }[] = [...LADDER, ...GOALS]
