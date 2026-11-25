import { BASELINE_FPS, GOALS, STEPS } from "@/lib/stages.mjs"

// Kept apart from lib/tracker, which carries the data files: the ladder is drawn in the browser too.
export const LADDER = STEPS.filter((m) => m.key !== "groundwork" && m.key !== "complete")

/** Short enough for the box that explains the colours. The Method page has the full wording. */
const HINTS: Record<string, string> = {
  loads: "The game’s program starts.",
  boots: "It draws a logo or a loading screen.",
  menu: "The menus open and respond.",
  world: "The game world is drawn, however broken.",
  playable: "You can move a character, at any speed.",
  smooth: `${BASELINE_FPS} fps or better and a clean picture, proven.`,
  beaten: "The main story finished like that, proven.",
}

/** The ladder and our goals after it: what the bars show, so a slow build doesn't look finished. */
export const ROAD = [...LADDER, ...GOALS].map(({ key, label }) => ({
  key,
  label,
  hint: HINTS[key],
}))
