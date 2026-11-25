import type { Slide } from "@/lib/broadcast"

const SECONDS = 10

/**
 * A new milestone, a project joining or going down, or a severity 3 wire item cuts straight in. What
 * a model wrote never does.
 */
export const cutsIn = (s: Slide) =>
  s.kind === "milestone" || s.kind === "board" || (s.kind === "wire" && s.item.severity === 3)

/** A slide's name, for someone who can't see which one is on screen. */
export function slideTitle(s: Slide) {
  switch (s.kind) {
    case "breakdown":
      return `Breakdown: ${s.breakdown.headline}`
    case "milestone":
      return s.title
    case "board":
      return s.event.title
    case "race":
      return "The race"
    case "commit":
      return `Just pushed: ${s.commit.name}`
    case "update":
      return s.text
    case "wire":
      return s.item.title
    case "trailer":
      return s.stream.title
  }
}

/** Ten seconds, and more when there is more to read: about three words a second. */
export function slideSeconds(s: Slide) {
  const words = (texts: string[]) => texts.join(" ").split(/\s+/).filter(Boolean).length
  if (s.kind === "breakdown") {
    const { headline, sentences } = s.breakdown
    const count = words([headline, ...sentences.map((x) => x.text)])
    return Math.min(40, Math.max(SECONDS, Math.ceil(count / 3) + 5))
  }
  return s.note ? SECONDS + Math.ceil(words([s.note]) / 3) : SECONDS
}
