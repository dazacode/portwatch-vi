/** Which colour each part of our score is drawn in: the same blocks as each project's ladder. */
export const SCORE_KEYS: { color: string; label: string; keys: string[] }[] = [
  { color: "var(--step-1)", label: "Exe runs", keys: ["groundwork", "loads"] },
  { color: "var(--step-2)", label: "First frame", keys: ["boots"] },
  { color: "var(--step-3)", label: "Main menu", keys: ["menu"] },
  { color: "var(--step-4)", label: "In the world", keys: ["world"] },
  { color: "var(--step-5)", label: "Runnable", keys: ["playable"] },
  {
    color: "var(--step-6)",
    label: "Picture, speed, stability",
    keys: ["render", "perf", "stability", "manual"],
  },
  { color: "var(--step-7)", label: "Story", keys: ["story"] },
]

export const scoreColor = (key: string) =>
  SCORE_KEYS.find((k) => k.keys.includes(key))?.color ?? "var(--step-6)"

/** Our score for one project, part by part: small enough to send to the browser. */
export type Ours = {
  rating: number
  parts: { key: string; label: string; claimed: number; counted: number }[]
}
