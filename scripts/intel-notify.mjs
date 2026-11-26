#!/usr/bin/env node
// Posts published reports, and corrections, to Discord. One message per item, then discordAt is set
// so a replay cannot post it twice. 429 is obeyed; a 404 is remembered by clearing the URL flag.
//
//   node scripts/intel-notify.mjs [--dry-run]
import path from 'node:path'
import { loadLedger, saveLedger } from './lib/intel/ledger.mjs'

const arg = (name, fallback = null) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}
const dryRun = process.argv.includes('--dry-run')
const DATA = path.resolve(arg('data') ?? path.join(new URL('..', import.meta.url).pathname, 'data'))
const URL_BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://viportlive.com').replace(/\/+$/, '')
const log = (line = '') => console.log(line)

const webhook = process.env.DISCORD_WEBHOOK_URL
if (!webhook) {
  log('DISCORD_WEBHOOK_URL is not set; nothing sent.')
  process.exit(0)
}

const ledger = await loadLedger(DATA)
const now = new Date().toISOString()

/** A report that published since the last run, or a retraction that did. */
const due = ledger.items
  .filter(
    (i) =>
      !i.discordAt &&
      (i.status === 'published' || (i.status === 'retracted' && i.audit?.kind === 'contradicted')) &&
      Date.parse(i.at) > Date.now() - 3 * 864e5
  )
  .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  .slice(0, 6)

const COLORS = { high: 0x3ee6d8, moderate: 0xff9a3c, low: 0x9a8fb0 }

async function post(item) {
  const correction = item.status === 'retracted'
  const embed = {
    title: (correction ? 'Correction: ' : '') + item.title,
    url: `${URL_BASE}/intelligence/${item.id}`,
    description: item.oneLine,
    color: correction ? 0xff3d9a : (COLORS[item.confidence?.bucket] ?? COLORS.low),
    timestamp: item.at,
    footer: { text: `VIPortLive Intelligence · ${correction ? 'retracted' : item.confidence?.bucket} confidence · ${item.sources.length} source${item.sources.length === 1 ? '' : 's'}` },
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      username: 'VIPortLive Intelligence',
      allowed_mentions: { parse: [] },
      embeds: [embed],
    }),
  })
  if (res.ok) return { ok: true }
  const wait = Number(res.headers.get('retry-after'))
  return { ok: false, status: res.status, wait: Number.isFinite(wait) ? wait : null }
}

let sent = 0
for (const item of due) {
  if (dryRun) {
    log(`would post ${item.id}`)
    continue
  }
  const result = await post(item)
  if (result.ok) {
    item.discordAt = now
    sent++
    log(`posted ${item.id}`)
    await new Promise((r) => setTimeout(r, 1200))
    continue
  }
  if (result.status === 404) {
    item.discordAt = 'gone'
    log(`! webhook 404 on ${item.id}`)
  } else if (result.wait) {
    await new Promise((r) => setTimeout(r, Math.min(result.wait * 1000, 20_000)))
  }
  log(`! ${item.id}: ${result.status ?? 'no answer'}`)
}

if (sent && !dryRun) await saveLedger(DATA, ledger)
log(`${sent} posted, ${due.length - sent} left.`)
