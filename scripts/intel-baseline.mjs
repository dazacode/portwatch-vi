#!/usr/bin/env node
// Indexes every build already known before the first discovery, so launch day is deltas and not a
// hundred "new build" reports. Reads upstream's tracker and our overrides; writes only
// data/intel-baseline.json and, when absent, an empty data/intel.json with cursors set.
//
//   node scripts/intel-baseline.mjs [--dry-run] [--no-fetch] [--root .] [--data data]
//
// Env: GITHUB_TOKEN for READMEs (optional; without it the identity fields are enough).
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readTracker } from './lib/tracker.mjs'
import { fingerprintOf } from './lib/intel/fingerprint.mjs'

const arg = (name) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? null : process.argv[at + 1]
}
const dryRun = process.argv.includes('--dry-run')
const fetchReadmes = !process.argv.includes('--no-fetch')
const ROOT = path.resolve(arg('root') ?? new URL('..', import.meta.url).pathname)
const DATA = path.resolve(arg('data') ?? path.join(ROOT, 'data'))
const WINDOW_HOURS = 6
const token = process.env.GITHUB_TOKEN
const log = (line = '') => console.log(line)

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(DATA, file), 'utf8'))
  } catch {
    return fallback
  }
}

const write = async (file, value) => {
  const target = path.join(DATA, file)
  if (dryRun) return log(`would write ${target}`)
  const tmp = `${target}.tmp-${process.pid}`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tmp, target)
}

async function readmeOf(repo) {
  if (!fetchReadmes || !repo) return ''
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`, {
      headers: { 'user-agent': 'viportlive-intel', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(6000),
    })
    return res.ok ? (await res.text()).slice(0, 6000) : ''
  } catch {
    return ''
  }
}

const tracker = await readTracker()
const intel = await readJson('intel.json', {
  updated: null,
  baselineAt: null,
  coverage: {},
  items: [],
  reports: [],
})

const now = new Date()
const windowStart = new Date(now.getTime() - WINDOW_HOURS * 36e5).toISOString()
const sources = ['activity', 'evidence', 'milestones', 'news', 'tracker']
for (const source of sources) {
  intel.coverage[source] ??= { lastCursor: windowStart, lastOkAt: null, seen: 0, events: 0, errors: 0 }
  intel.coverage[source].lastCursor = intel.coverage[source].lastCursor ?? windowStart
}

const entries = []
for (const effort of tracker.efforts) {
  const readme = await readmeOf(effort.repo)
  entries.push({
    effortId: effort.id,
    repo: effort.repo,
    at: effort.nuked?.at ?? tracker.updated,
    ...fingerprintOf({
      repo: effort.repo,
      name: effort.name,
      id: effort.id,
      summary: effort.summary,
      readme,
      credits: effort.basedOn ?? [],
    }),
  })
  if (fetchReadmes) log(`  ${effort.id}${readme ? '' : ' (identity only)'}`)
}

intel.baselineAt = intel.baselineAt ?? now.toISOString()
intel.updated = now.toISOString()
await write('intel-baseline.json', {
  at: now.toISOString(),
  windowStart,
  count: entries.length,
  entries,
})
await write('intel.json', intel)
log(`${entries.length} build(s) indexed; ${dryRun ? 'nothing written' : 'baseline saved'}.`)
