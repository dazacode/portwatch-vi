import { MILESTONES } from "@/lib/scoring.mjs"

// Kept apart from lib/tracker, which carries the data files: the ladder is drawn in the browser too.
export const LADDER = MILESTONES.filter((m) => m.key !== "groundwork" && m.key !== "complete")
