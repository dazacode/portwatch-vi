// The report, and the desk. A model writes prose; code writes the skeleton, holds it to the sources
// and decides what happens when the model is wrong or absent.
import { z } from 'zod'

const SECTIONS = ['overview', 'changed', 'evidence', 'unknown']
const LABEL = {
  reference: 'new build reference',
  update: 'change to its build record',
  evidence: 'new independent test report',
  claim: 'new claim',
  takedown: 'takedown report',
  duplicate: 'possible duplicate',
  audit: 'audit finding',
  'ingest-gap': 'source gap',
}

const strip = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()
const sentences = (text) => (strip(text).match(/[.!?](?:\s|$)/g) ?? []).length
const numbers = (text) => strip(text).match(/\d+(?:[.,]\d+)?/g) ?? []

/** At most two sentences, closed, so a long quote cannot push a section past four. */
const brief = (text) => {
  const parts = strip(text).split(/(?<=[.!?…])\s+/).slice(0, 2).join(' ')
  return `${parts.replace(/[.!?…]+$/, '')}.`
}

export function skeleton(item) {
  const name = item.projectName ?? 'The scene'
  const sources = item.sources ?? []
  const first = sources[0]
  const outlets = [...new Set(sources.map((s) => s.outlet))].join(', ')
  const line = brief(item.oneLine)
  const count = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][sources.length] ?? String(sources.length)
  const changedBody = {
    reference: `A repository or record that was not in the baseline is now attached to the board. ${line}`,
    update: `The project’s record moved. ${line}`,
    evidence: `An outside report adds a reading for the project. ${line}`,
    claim: `A new public claim has been logged for the project. ${line}`,
    takedown: `The project or its code is reported as gone. ${line}`,
    duplicate: `${line} It is not merged until a person or the desk confirms it.`,
    audit: `${line} The published entry is left in place for now.`,
    'ingest-gap': `${line} Reading resumes from the stored cursor.`,
  }[item.kind] ?? `${line} It is on the record.`
  return {
    overview: `${name} has a ${LABEL[item.kind] ?? 'new record'} on VIPortLive. The entry is logged from public material and carries its confidence and sources below.`,
    changed: changedBody,
    evidence: `The entry rests on ${count} stored source${sources.length === 1 ? '' : 's'}${outlets ? `${sources.length === 1 ? ', ' : ', including '}${outlets}` : ''}. ${first ? brief(first.excerpt && first.excerpt !== first.title ? first.excerpt : (first.title ?? '')) : 'No excerpt was stored.'}`,
    unknown: `The build’s authenticity is not established by this entry, and neither is what it means for a release. ${item.confidence?.conflict ? 'The sources disagree, so the reading is provisional.' : 'Any figure above is what a source said, not a measurement we took.'}`,
  }
}

export function sectionProblems(sections, sources) {
  const text = sources.map((s) => `${s.title} ${s.excerpt ?? ''}`).join(' ')
  const known = new Set(numbers(text))
  const problems = []
  for (const key of SECTIONS) {
    const value = strip(sections?.[key])
    if (value.length < 40) problems.push(`${key} is too short`)
    if (sentences(value) > 5) problems.push(`${key} is more than 5 sentences`)
    if (/https?:\/\//.test(value)) problems.push(`${key} contains a link`)
    for (const number of numbers(value)) {
      if (!known.has(number) && !known.has(number.replace(',', '.'))) problems.push(`${key} has ${number}, which is not in a source`)
    }
  }
  return [...new Set(problems)]
}

export const reportSchema = z.object({
  overview: z.string().min(40).max(700),
  changed: z.string().min(40).max(700),
  evidence: z.string().min(40).max(700),
  unknown: z.string().min(40).max(700),
})

export const REPORT_SYSTEM = `You write a four-part intelligence report for VIPortLive, an unofficial tracker of GTA VI on PC.
Use only the facts in the notes and excerpts. Never add a number, name, date or link that is not there.
Each of the four keys is 2 to 4 short sentences, plain and factual, no lists, no links, no markdown.
overview: what the entry is. changed: what moved in the record. evidence: what supports it and what each source is.
unknown: what is still unverified, always including that authenticity and release meaning are not established.
Never say a build is authentic, confirmed or official. Do not copy sentences; quote at most a few words.`

export const deskSchema = z.object({
  decision: z.enum(['publish', 'hold', 'retract']),
  reason: z.string().min(8).max(200),
})

export const DESK_SYSTEM = `You are the duty editor for VIPortLive, an unofficial GTA VI on PC tracker.
Decide one held item. "publish" only when the stored sources plainly support the one line and no source disagrees.
"hold" when a source is thin, off-topic or only repeats another. "retract" when the item is contradicted.
Rules: a project's own repository is a primary source but not independent. A social post alone is weak.
Never invent facts. Give a reason of one sentence.`

const notes = (item) => ({
  entry: { kind: item.kind, project: item.projectName, title: item.title, oneLine: item.oneLine },
  confidence: item.confidence,
  sources: (item.sources ?? []).map((s) => ({
    outlet: s.outlet,
    title: s.title,
    kind: s.kind,
    excerpt: (s.excerpt ?? '').slice(0, 500),
  })),
})

/** One model call. Returns sections only when they pass the source check. */
export async function askReport(ai, item) {
  const reply = await ai.ask({
    system: REPORT_SYSTEM,
    user: JSON.stringify(notes(item)),
    schema: reportSchema,
    maxTokens: 1400,
  })
  if (!reply.ok) return { ok: false, why: reply.reason }
  const problems = sectionProblems(reply.value, item.sources ?? [])
  if (problems.length) return { ok: false, why: problems.slice(0, 2).join('; ') }
  return { ok: true, sections: reply.value, by: reply.by }
}

export async function askDesk(ai, item) {
  const reply = await ai.ask({
    system: DESK_SYSTEM,
    user: JSON.stringify(notes(item)),
    schema: deskSchema,
    maxTokens: 300,
  })
  return reply.ok ? { ok: true, ...reply.value, by: reply.by } : { ok: false, why: reply.reason }
}
