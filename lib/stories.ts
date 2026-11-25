// Search, topic and order for the news page. Runs in the browser, so it reads no data itself.
import type { FeedItem } from "@/lib/tracker"

export const TOPICS = [
  "Takedown",
  "Legal",
  "Security",
  "Port",
  "Leak",
  "Official",
  "Game",
  "Community",
]

export type Story = Pick<FeedItem, "id" | "title" | "url" | "outlet" | "date" | "via"> & {
  topic: string
  summary: string | null
  similar: number
  weight: number
}

export const SORTS = {
  newest: "Newest first",
  important: "Most important",
  oldest: "Oldest first",
} as const
export type Sort = keyof typeof SORTS
export type Filters = { q: string; topic: string; sort: Sort }

export const NO_FILTERS: Filters = { q: "", topic: "all", sort: "newest" }
export const MAX_QUERY = 60

/** Anything unknown falls back to the default. "category" is the name older links use. */
export function parseFilters(params: Pick<URLSearchParams, "get">): Filters {
  const topic = params.get("topic") ?? params.get("category")
  const sort = params.get("sort")
  return {
    q: (params.get("q") ?? "").slice(0, MAX_QUERY),
    topic: TOPICS.find((t) => t.toLowerCase() === topic?.toLowerCase()) ?? "all",
    sort: (Object.keys(SORTS) as Sort[]).find((s) => s === sort) ?? "newest",
  }
}

/** The query string without what is at its default. */
export function toQuery(filters: Filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim() && value !== NO_FILTERS[key as keyof Filters]) params.set(key, value)
  }
  return params.toString()
}

// Six points a day, the same as in scripts/lib/digest.mjs.
const AGE = 6
const DAY = 864e5

export function applyFilters(stories: Story[], f: Filters): Story[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean)
  const found = stories.filter((s) => {
    const text = `${s.title} ${s.summary ?? ""} ${s.outlet} ${s.topic}`.toLowerCase()
    return (f.topic === "all" || s.topic === f.topic) && terms.every((t) => text.includes(t))
  })
  const time = (s: Story) => Date.parse(s.date)
  // Only the differences count, so ages need no clock.
  const rank = (s: Story) => s.weight + (AGE * time(s)) / DAY
  if (f.sort === "important") return found.sort((a, b) => rank(b) - rank(a) || time(b) - time(a))
  return found.sort((a, b) => (f.sort === "oldest" ? time(a) - time(b) : time(b) - time(a)))
}
