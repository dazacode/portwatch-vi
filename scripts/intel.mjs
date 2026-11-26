#!/usr/bin/env node
// The intelligence run: read forward from each source cursor, write events, gate them, produce a
// report for what clears the gate, and let a free desk model decide on weak held items.
//
//   node scripts/intel.mjs [--dry-run] [--no-model] [--limit 40] [--root .] [--data data]
//
// Env: ANTHROPIC-free route from scripts/lib/free-ai.mjs. FREE_AI=off turns the model off.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { gate } from '../lib/intel-gate.mjs'
import { createFreeAi, providersFrom } from './lib/free-ai.mjs'
import { detect } from './lib/intel/detect.mjs'
import { chainAll, loadLedger, makeReport, mergeItems, prune, saveLedger } from './lib/intel/ledger.mjs'
import { askDesk, askReport, sectionProblems, skeleton } from './lib/intel/report.mjs'
import { readTracker } from './lib/tracker.mjs'

const arg = (name, fallback = null) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}
const dryRun = process.argv.includes('--dry-run')
const noModel = process.argv.includes('--no-model')
const noDesk = process.argv.includes('--no-desk')
const ROOT = path.resolve(arg('root') ?? new URL('..', import.meta.url).pathname)
const DATA = path.resolve(arg('data') ?? path.join(ROOT, 'data'))
const LIMIT = Number(arg('limit', 40))
const PER_RUN = 3
const MODEL_REPORTS = 2
const DESK_DECISIONS = 2
const PER_DAY = 8
const PER_PROJECT_HOURS = 6
const log = (line = '') => console.log(line)

const read = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(DATA, file), 'utf8'))
  } catch {
    return fallback
  }
}

const failures = []
const readSource = async (file, key, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(DATA, file), 'utf8'))
  } catch {
    failures.push(key)
    return fallback
  }
}

const ledger = await loadLedger(DATA)
if (!ledger.baselineAt) {
  log('! no baselineAt; run scripts/intel-baseline.mjs first. Everything will be held.')
}
const baseline = await read('intel-baseline.json', { entries: [] })
ledger.baseline = baseline

const tracker = await readTracker()
const evidence = await readSource('evidence.json', 'evidence', { items: [] })
const milestones = await readSource('milestones.json', 'milestones', [])
const activity = await readSource('activity.json', 'activity', { projects: {}, feed: [], discovered: [] })
const news = await readSource('news.json', 'news', { items: [] })

const now = new Date()
const iso = now.toISOString()
const result = detect({ tracker, evidence, milestones, activity, news, intel: ledger, failures, now: iso })
const fresh = mergeItems(ledger, result.items).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, LIMIT)

const providers = noModel ? [] : providersFrom(process.env)
const ai = providers.length
  ? createFreeAi({ providers, maxRequests: 5, budgetMs: 5 * 6e4, timeoutMs: 60_000, log })
  : null

const today = iso.slice(0, 10)
const beforePublished = ledger.items.filter((i) => i.status === 'published').length
const publishedToday = () => ledger.items.filter((i) => i.status === 'published' && i.publishedAt?.startsWith(today)).length
const recentProject = (id) =>
  ledger.items.some(
    (i) => i.projectId === id && i.status === 'published' && Date.parse(i.publishedAt ?? i.at) > now.getTime() - PER_PROJECT_HOURS * 36e5
  )
let left = PER_RUN
let modeled = 0
const openGap = failures.length > 0

function attach(item, status, reasons) {
  item.status = status
  item.heldReasons = reasons
  item.chain = ''
  ledger.items.push(item)
}

function publish(item, sections, by) {
  if (!ledger.items.includes(item)) ledger.items.push(item)
  item.status = 'published'
  item.publishedAt = iso
  item.heldReasons = []
  item.reportId = `${item.id}-report`
  const report = makeReport(item, sections, by, iso)
  ledger.reports.push(report)
  if (publishedToday() < PER_DAY && left > 0) left--
  return report
}

for (const item of fresh) {
  const decision = gate(item, {
    openGap: openGap && item.kind !== 'ingest-gap',
    duplicate: item.kind === 'duplicate',
  })
  const capped = left <= 0 || publishedToday() >= PER_DAY || (item.projectId && recentProject(item.projectId))
  if (process.argv.includes('--print')) log(`  ${decision.status} ${item.kind} ${item.id}: ${item.title} (${item.confidence.bucket})`)
  if (decision.status === 'published' && capped) {
    attach(item, 'held', ['a rate cap'])
    continue
  }
  if (decision.status === 'held') {
    attach(item, 'held', decision.reasons)
    continue
  }
  if (item.kind === 'ingest-gap') {
    attach(item, 'held', ['source gap'])
    continue
  }

  let sections = null
  let by = 'rules'
  if (ai && modeled < MODEL_REPORTS) {
    modeled++
    const reply = await askReport(ai, item)
    if (reply.ok) {
      sections = reply.sections
      by = 'free'
    } else {
      item.note = `model: ${reply.why}`
      log(`  ! report skeleton for ${item.id}: ${reply.why}`)
    }
  }
  sections = sections ?? skeleton(item)
  const problems = sectionProblems(sections, item.sources)
  if (problems.length) {
    sections = skeleton(item)
    by = 'rules'
  }
  publish(item, sections, by)
}

if (!dryRun) {
  ledger.updated = iso
  chainAll(ledger)
  await saveLedger(DATA, ledger)
}

/* ---------- Desk: a free model decides on weak held items ---------- */
if (ai && !noDesk) {
  const weak = ledger.items
    .filter((i) => i.status === 'held' && i.kind !== 'ingest-gap' && !i.audit && i.sources?.length && !i.confidence?.conflict)
    .filter((i) => !i.heldReasons?.includes('duplicate build reference') && !i.sensitive)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, DESK_DECISIONS)
  for (const item of weak) {
    const reply = await askDesk(ai, item)
    log(`  desk ${item.id}: ${reply.ok ? reply.decision : reply.why}`)
    if (!reply.ok) continue
    item.revisions.push({ at: iso, by: 'desk', note: reply.reason })
    if (reply.decision === 'retract') {
      item.status = 'retracted'
      continue
    }
    if (reply.decision !== 'publish') continue
    if (left <= 0 || publishedToday() >= PER_DAY) continue
    if (item.projectId && recentProject(item.projectId)) continue
    item.confidence = {
      ...item.confidence,
      reasons: [...(item.confidence?.reasons ?? []), 'published by the desk after review'],
    }
    publish(item, skeleton(item), 'desk')
  }
}

ledger.coverage = result.coverage
ledger.updated = iso
prune(ledger, now.getTime())
chainAll(ledger)

const counts = fresh.reduce((all, i) => ({ ...all, [i.status]: (all[i.status] ?? 0) + 1 }), {})
const nowPublished = ledger.items.filter((i) => i.status === 'published').length - beforePublished
log(`${fresh.length} new, ${counts.held ?? 0} held, ${nowPublished} published this run, ${result.errors.length} gap(s)`)
if (failures.length) log(`! sources that did not read: ${failures.join(', ')}`)

if (dryRun) log('dry run: nothing written')
else await saveLedger(DATA, ledger)

process.exit(failures.length && !fresh.length ? 1 : 0)
