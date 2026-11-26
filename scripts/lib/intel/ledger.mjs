// Reading, merging, chaining and pruning the ledger. The one writer is the CLI or intel.mjs, never a page.
import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chainOf, eventKey, KINDS, STATUSES } from '../../../lib/intel-gate.mjs'

export const DAYS = 30
const DAY = 864e5

export const empty = () => ({
  updated: null,
  baselineAt: null,
  coverage: {},
  items: [],
  reports: [],
})

export const isLedger = (value) =>
  Boolean(value) &&
  Array.isArray(value.items) &&
  Array.isArray(value.reports) &&
  (value.coverage === undefined || typeof value.coverage === 'object')

export async function loadLedger(dataDir) {
  const file = path.join(dataDir, 'intel.json')
  try {
    const value = JSON.parse(await readFile(file, 'utf8'))
    if (!isLedger(value)) throw new Error('shape')
    return value
  } catch (err) {
    if (err.code === 'ENOENT') return empty()
    throw new Error(`data/intel.json is not usable: ${err.message}`)
  }
}

/** The same event cannot enter twice, whether by id or by kind, project, source and half-day. */
export function mergeItems(ledger, items) {
  const keys = new Set(ledger.items.map((i) => i.key ?? eventKey({ kind: i.kind, projectId: i.projectId, url: i.sources?.[0]?.url ?? '', at: i.at })))
  const ids = new Set(ledger.items.map((i) => i.id))
  const added = []
  for (const item of items) {
    const key = item.key ?? eventKey({
      kind: item.kind,
      projectId: item.projectId,
      url: item.sources?.[0]?.url ?? '',
      at: item.at,
    })
    if (ids.has(item.id) || keys.has(key)) continue
    ids.add(item.id)
    keys.add(key)
    added.push(item)
  }
  return added
}

export function chainAll(ledger) {
  let prev = null
  for (const item of ledger.items) {
    const hash = createHash('sha256').update(chainOf(prev, item)).digest('hex')
    item.chain = `sha256:${hash}`
    prev = item.chain
  }
}

export function verifyChain(ledger) {
  let prev = null
  for (const item of ledger.items) {
    const want = `sha256:${createHash('sha256').update(chainOf(prev, item)).digest('hex')}`
    if (item.chain !== want) return { ok: false, id: item.id, want, got: item.chain }
    prev = item.chain
  }
  return { ok: true }
}

/** The report inherits the item's sources; a model never supplies a URL. */
export function makeReport(item, sections, by, at = new Date().toISOString()) {
  return {
    id: item.reportId ?? `${item.id}-report`,
    itemId: item.id,
    publishedAt: at,
    by,
    confidence: item.confidence?.bucket ?? 'low',
    ...sections,
    sources: item.sources ?? [],
  }
}

/** Keep a month of history, and every held or published report inside it. */
export function prune(ledger, now = Date.now()) {
  const live = ledger.items.filter((i) => {
    const at = Date.parse(i.at)
    return !Number.isFinite(at) || now - at < DAYS * DAY || i.status === 'held'
  })
  const ids = new Set(live.map((i) => i.id))
  return {
    ...ledger,
    items: live,
    reports: ledger.reports.filter((r) => ids.has(r.itemId)),
  }
}

export const statusOk = (status) => STATUSES.includes(status)
export const kindOk = (kind) => KINDS.includes(kind)

export async function saveLedger(dataDir, ledger) {
  if (!isLedger(ledger)) throw new Error('refusing to write a ledger with the wrong shape')
  const target = path.join(dataDir, 'intel.json')
  const tmp = `${target}.tmp-${process.pid}`
  const text = `${JSON.stringify(ledger, null, 2)}\n`
  JSON.parse(text)
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, target)
}
