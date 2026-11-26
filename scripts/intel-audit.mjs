#!/usr/bin/env node
// Re-reads what was published and repairs the record: dead links, edited sources, contradictions.
// Writes revisions, demotes or retracts, never deletes.
//
//   node scripts/intel-audit.mjs [--dry-run] [--limit 25] [--root .] [--data data]
import path from 'node:path'
import { auditOutcome, bucketAtLeast } from '../lib/intel-gate.mjs'
import { chainAll, loadLedger, saveLedger } from './lib/intel/ledger.mjs'

const arg = (name, fallback = null) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}
const dryRun = process.argv.includes('--dry-run')
const ROOT = path.resolve(arg('root') ?? new URL('..', import.meta.url).pathname)
const DATA = path.resolve(arg('data') ?? path.join(ROOT, 'data'))
const LIMIT = Number(arg('limit', 25))
const DAYS = 14
const log = (line = '') => console.log(line)

const ledger = await loadLedger(DATA)
const now = new Date()
const iso = now.toISOString()
const recent = ledger.items
  .filter((i) => i.status === 'published' && Date.parse(i.at) > now.getTime() - DAYS * 864e5)
  .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  .slice(0, LIMIT)

const numbersOf = (text) => new Set(String(text).match(/\d+(?:[.,]\d+)?/g) ?? [])

async function check(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'viportlive-audit' },
      signal: AbortSignal.timeout(10_000),
    })
    const final = res.url || url
    const text = res.ok ? (await res.text()).slice(0, 250_000) : ''
    return { status: res.status, final, text }
  } catch (err) {
    return { status: 0, final: url, text: '', error: err.message }
  }
}

const findings = []
for (const item of recent) {
  const report = ledger.reports.find((r) => r.itemId === item.id && r.id === item.reportId)
  if (!report) continue
  const primary = item.sources.find((s) => s.kind === 'primary') ?? item.sources[0]
  if (!primary) continue

  const answer = await check(primary.url)
  let finding = null
  let detail = ''
  if (answer.status === 404 || answer.status === 410 || answer.status === 451) {
    finding = 'dead-link'
    detail = `answered ${answer.status}`
  } else if (answer.final.replace(/#.*$/, '') !== primary.url.replace(/#.*$/, '')) {
    finding = 'moved'
    detail = `now at ${answer.final}`
    const before = primary.url
    primary.url = answer.final
    primary.host = new URL(answer.final).hostname
    for (const source of report.sources) if (source.url === before) source.url = answer.final
  } else if (answer.text) {
    const text = answer.text.replace(/<[^>]+>/g, ' ')
    const numbers = numbersOf(`${report.overview} ${report.changed} ${report.evidence}`)
    const missing = [...numbers].filter((n) => !text.includes(n) && !text.includes(n.replace(',', '.')))
    if (missing.length >= 2) {
      finding = 'unsupported'
      detail = `source no longer contains ${missing.slice(0, 3).join(', ')}`
    }
  }

  // A newer, stronger item from another source that says the opposite.
  const newer = ledger.items.find(
    (i) =>
      i.projectId === item.projectId &&
      i.id !== item.id &&
      Date.parse(i.at) > Date.parse(item.at) &&
      Date.parse(i.at) < Date.parse(item.at) + 48 * 36e5 &&
      bucketAtLeast(i.confidence?.bucket, 'moderate') &&
      /fail/i.test(i.oneLine) !== /fail/i.test(item.oneLine)
  )
  if (!finding && newer && newer.confidence?.bucket !== 'low') {
    finding = 'contradicted'
    detail = `contradicted by ${newer.id}`
  }

  if (!finding) continue
  const outcome = auditOutcome(finding)
  item.audit = { kind: finding, at: iso, by: 'intel-audit', detail }
  item.revisions.push({ at: iso, by: 'intel-audit', note: outcome.note })
  if (finding === 'contradicted') {
    item.revisions.push({ at: iso, by: 'intel-audit', note: detail })
  }
  if (outcome.status) item.status = outcome.status
  if (finding === 'contradicted') item.discordAt = null
  findings.push(`${finding}: ${item.id}`)
  log(`  ${finding}: ${item.id} (${detail})`)
}

ledger.updated = iso
chainAll(ledger)
log(`${recent.length} checked, ${findings.length} finding(s)`)
if (dryRun) log('dry run: nothing written')
else if (findings.length) await saveLedger(DATA, ledger)

process.exit(findings.length ? 1 : 0)
