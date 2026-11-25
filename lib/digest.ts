import { z } from "zod"
import localDigest from "@/data/digest.json"
import { loadData } from "@/lib/data"
import { isHostile, noteId, plain, unsafe } from "@/lib/digest-safety.mjs"
import { isHidden } from "@/lib/hide"
import { type Story, TOPICS } from "@/lib/stories"
import type { NewsFile, Tracker } from "@/lib/tracker"

/** Where a line comes from. Only the id is stored: the address is always ours. */
export type Source = { ref: string; label: string; href: string; external: boolean; at: string }
export type Line = { text: string | null; sources: Source[] }

const ref = z.string().max(260)
const line = z.object({ text: z.string().nullable(), sources: z.array(ref).min(1) })
const schema = z.object({
  version: z.literal(1),
  updated: z.string(),
  now: z.object({ at: z.string(), by: z.string().nullable(), points: z.array(line) }),
  breakdowns: z
    .object({
      at: z.string(),
      by: z.string().nullable(),
      items: z.array(
        z.object({ topic: z.string(), headline: z.string(), sentences: z.array(line) })
      ),
    })
    .nullable()
    .catch(null),
  notes: z
    .record(z.string(), z.object({ text: z.string().nullable(), by: z.string(), at: z.string() }))
    .catch({}),
  stories: z.record(
    z.string(),
    z.object({
      topic: z.string(),
      weight: z.number(),
      lead: z.string().optional(),
      similar: z.number().optional(),
      summary: z.string().nullable(),
      by: z.string().nullable(),
    })
  ),
  projects: z.record(
    z.string(),
    z.object({ summary: z.string(), by: z.string(), at: z.string(), count: z.number() })
  ),
})

export type Digest = z.infer<typeof schema>

/** Null for anything that isn't a digest this code knows, so a page can do without it. */
export function parseDigest(value: unknown): Digest | null {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export const getDigest = async () =>
  parseDigest(await loadData<unknown>("digest.json", localDigest))

const HOUR = 36e5
/** A summary older than this is not shown. */
export const SUMMARY_HOURS = 36
export const BREAKDOWN_HOURS = 24
/** A breakdown also goes when its newest source is older than this. */
export const SOURCE_HOURS = 72
export const MAX_BREAKDOWNS = 5
const TEXT = 260

export const isFresh = (at: string, hours: number, now: number) => {
  const age = now - Date.parse(at)
  return age < hours * HOUR && age > -HOUR
}

const isLink = (url: string) => /^https?:\/\//.test(url)
/** Checked again here, so a digest edited by hand or by a merge can't say more than a new one. */
const isFine = (text: string, max = TEXT) =>
  text === plain(text) && !unsafe(text, max) && !isHidden(text)

/** Everything a line may point to, by id. An id that isn't here has no source any more. */
export function sourcesOf(feed: NewsFile, tracker: Pick<Tracker, "news" | "efforts">) {
  const all: Source[] = [
    ...feed.items
      .filter((s) => isLink(s.url) && !isHidden(s))
      .map((s) => ({
        ref: `story:${s.id}`,
        label: s.outlet,
        href: s.url,
        external: true,
        at: s.date,
      })),
    ...tracker.news
      .filter((n) => !isHidden(n))
      .map((n) => ({
        ref: `article:${n.id}`,
        label: "Article",
        href: `/news/${n.id}`,
        external: false,
        at: n.date,
      })),
    ...tracker.efforts.map((e) => ({
      ref: `project:${e.id}`,
      label: e.name,
      href: `/projects/${e.id}`,
      external: false,
      at: "",
    })),
  ]
  return new Map(all.map((s) => [s.ref, s]))
}

/** A line with its sources, or null when one of them is gone. */
function resolve({ text, sources }: z.infer<typeof line>, known: Map<string, Source>): Line | null {
  const found = sources.flatMap((r) => known.get(r) ?? [])
  if (!found.length || found.length < sources.length) return null
  if (text !== null && !isFine(text)) return null
  return { text, sources: found }
}

export type Summary = {
  at: string
  /** "Provider, model", or null when rules picked the headlines. */
  by: string | null
  points: { text: string; href: string; external: boolean; sources: Source[] }[]
  projects: { id: string; name: string; text: string }[]
}

export function getSummary(
  digest: Digest | null,
  feed: NewsFile,
  tracker: Pick<Tracker, "news" | "efforts">,
  now = Date.now()
): Summary | null {
  if (!digest || !isFresh(digest.now.at, SUMMARY_HOURS, now)) return null
  const known = sourcesOf(feed, tracker)
  const titles = new Map(feed.items.map((s) => [`story:${s.id}`, s.title]))
  const points = digest.now.points.flatMap((p) => {
    const found = resolve(p, known)
    const text = found && (found.text ?? titles.get(found.sources[0].ref))
    return found && text
      ? [
          {
            text,
            href: found.sources[0].href,
            external: found.sources[0].external,
            sources: found.sources,
          },
        ]
      : []
  })
  const projects = tracker.efforts.flatMap((e) => {
    const p = digest.projects[e.id]
    return p && !e.nuked && isFine(p.summary) && isFresh(p.at, 24, now)
      ? [{ id: e.id, name: e.name, text: p.summary, count: p.count }]
      : []
  })
  projects.sort((a, b) => b.count - a.count)
  if (!points.length) return null
  return {
    at: digest.now.at,
    by: digest.now.by,
    points,
    projects: projects.map(({ id, name, text }) => ({ id, name, text })),
  }
}

/* ---------- Stories ---------- */

export function toStories(feed: NewsFile, digest: Digest | null): Story[] {
  return feed.items
    .filter((s) => isLink(s.url) && !isHidden(s))
    .map(({ id, title, url, outlet, date, via, category }) => {
      const d = digest && Object.hasOwn(digest.stories, id) ? digest.stories[id] : null
      const topic = [d?.topic, category].find((t) => t && TOPICS.includes(t)) ?? "Community"
      const summary =
        d?.by && d.summary && isFine(d.summary) && !isHostile(title) ? d.summary : null
      const similar = d?.similar ?? 0
      return { id, title, url, outlet, date, via, topic, summary, similar, weight: d?.weight ?? 0 }
    })
}

/* ---------- The news slides ---------- */

export type Breakdown = {
  id: string
  topic: string
  headline: string
  sentences: { text: string; sources: Source[] }[]
  /** Every source once, the first sentence's first. */
  sources: Source[]
  by: string
  at: string
}

/**
 * Stale ones are left out: written over BREAKDOWN_HOURS ago, or with nothing newer than SOURCE_HOURS
 * behind them. So are ones with a missing source or fewer than two sentences left.
 */
export function getBreakdowns(
  digest: Digest | null,
  feed: NewsFile,
  tracker: Pick<Tracker, "news" | "efforts">,
  now = Date.now()
): Breakdown[] {
  const set = digest?.breakdowns
  if (!set?.by || !isFresh(set.at, BREAKDOWN_HOURS, now)) return []
  const { by, at } = set
  const known = sourcesOf(feed, tracker)
  return set.items
    .flatMap(({ topic, headline, sentences }): Breakdown[] => {
      const lines = sentences.slice(0, 3).flatMap((s) => {
        const found = resolve(s, known)
        return found?.text ? [{ text: found.text, sources: found.sources }] : []
      })
      const sources = [...new Map(lines.flatMap((l) => l.sources).map((s) => [s.ref, s])).values()]
      const recent = sources.some((s) => now - Date.parse(s.at) < SOURCE_HOURS * HOUR)
      if (lines.length < 2 || !recent || !isFine(headline, 80)) return []
      const id = `breakdown:${topic}:${at}`
      return [{ id, topic, headline, sentences: lines, sources, by, at }]
    })
    .slice(0, MAX_BREAKDOWNS)
}

/** The line about one commit, pull request or tracker change, if there is one for exactly that. */
export function getNote(
  digest: Digest | null,
  item: { url?: string; date?: string; text?: string }
): string | null {
  const id = noteId(item)
  const note = id && digest && Object.hasOwn(digest.notes, id) ? digest.notes[id] : null
  return note?.text && isFine(note.text) ? note.text : null
}
