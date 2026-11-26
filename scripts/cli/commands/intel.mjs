// The intel desk: read the queue, add a source, publish, retract, verify.
import { assess } from '../../../lib/intel-gate.mjs'
import { chainAll, loadLedger, makeReport, verifyChain } from '../../lib/intel/ledger.mjs'
import { sectionProblems, skeleton } from '../../lib/intel/report.mjs'
import { invalid, notFound } from '../lib/errors.mjs'

const now = () => new Date().toISOString()
const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '')
const note = (item, by, text) => item.revisions.push({ at: now(), by, note: clip(text, 240) })

const find = (ledger, id) => {
  const item = ledger.items.find((i) => i.id === id)
  if (!item) throw notFound(`No intelligence item "${id}".`)
  return item
}

export const intel = {
  summary: 'The intelligence ledger: queue, inspect, source, publish, retract, verify.',
  usage:
    'list | queue | show <id> | source <id> --url ... | publish <id> --note ... | hold <id> --reason ... | retract <id> --reason ... | verify | rebuild | audit',
  value: ['status', 'kind', 'project', 'limit', 'url', 'outlet', 'title', 'excerpt', 'note', 'reason', 'by'],
  async run({ out, paths, flags }, [action, ...rest]) {
    const ledger = await loadLedger(paths.dataDir)
    const flag = (name) => flags[name]?.at?.(-1) ?? flags[name] ?? null

    if (action === 'list' || action === 'queue') {
      const status = action === 'queue' ? 'held' : flag('status')
      const kind = flag('kind')
      const project = flag('project')
      const limit = Number(flag('limit') ?? 30)
      const rows = ledger.items
        .filter((i) => (!status || i.status === status) && (!kind || i.kind === kind) && (!project || i.projectId === project))
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, limit)
      out.table(
        rows.map((i) => [i.at.slice(0, 16), i.id, i.status, i.kind, i.confidence?.bucket ?? '-', clip(i.title, 60)]),
        ['at', 'id', 'status', 'kind', 'confidence', 'title']
      )
      return { count: rows.length, items: rows }
    }

    if (action === 'show') {
      const item = find(ledger, rest[0])
      out.line(`${item.title} (${item.id})`)
      out.line(`${item.kind}, ${item.at}, ${item.status}, ${item.confidence?.bucket}`)
      out.line(item.oneLine)
      for (const reason of item.heldReasons ?? []) out.line(`held: ${reason}`)
      for (const source of item.sources) out.line(`source: ${source.outlet} — ${source.title} <${source.url}>`)
      const report = ledger.reports.find((r) => r.id === item.reportId)
      if (report) {
        out.line('')
        out.line(report.overview)
        out.line(report.changed)
        out.line(report.evidence)
        out.line(report.unknown)
      }
      return { item, report: report ?? null, live: await liveCheck(item) }
    }

    if (action === 'verify') {
      const result = verifyChain(ledger)
      out.line(result.ok ? 'chain is intact' : `chain breaks at ${result.id}`)
      return result
    }

    if (action === 'audit') {
      const rows = ledger.items.filter((i) => i.audit || i.status === 'retracted')
      out.table(
        rows.map((i) => [i.audit?.at ?? i.at, i.id, i.status, i.audit?.kind ?? '-', clip(i.title, 50)]),
        ['at', 'id', 'status', 'audit', 'title']
      )
      return { count: rows.length, items: rows }
    }

    if (action === 'rebuild') {
      chainAll(ledger)
      out.line('chain rebuilt')
      return { intel: ledger }
    }

    const item = find(ledger, rest[0])

    if (action === 'source' || action === 'repair') {
      const url = flag('url')
      if (!url || !/^https:\/\//.test(url)) throw invalid('--url must be an https link.')
      const kind = action === 'repair' ? 'primary' : 'outside'
      const source = {
        url,
        host: hostOf(url),
        outlet: clip(flag('outlet') ?? hostOf(url), 60),
        title: clip(flag('title') ?? url, 160),
        at: now(),
        kind,
        excerpt: clip(flag('excerpt') ?? '', 500),
      }
      item.sources.push(source)
      item.confidence = assess({ sources: item.sources, conflict: item.confidence?.conflict, baselineAt: ledger.baselineAt })
      note(item, flag('by') ?? 'owner', `source added: ${url}`)
      out.line(`added ${kind} source to ${item.id}`)
      return { item, intel: ledger }
    }

    if (action === 'hold') {
      item.status = 'held'
      item.heldReasons = [clip(flag('reason') ?? 'held by hand', 120)]
      note(item, flag('by') ?? 'owner', flag('reason') ?? 'held by hand')
      out.line(`held ${item.id}`)
      return { item, intel: ledger }
    }

    if (action === 'retract') {
      item.status = 'retracted'
      item.audit = { kind: 'manual', at: now(), by: flag('by') ?? 'owner', detail: clip(flag('reason') ?? 'retracted by hand', 240) }
      note(item, flag('by') ?? 'owner', flag('reason') ?? 'retracted')
      out.line(`retracted ${item.id}`)
      return { item, intel: ledger }
    }

    if (action === 'publish') {
      if (!item.sources.length) throw invalid('An item needs a source before it can publish.')
      const sections = skeleton(item)
      const problems = sectionProblems(sections, item.sources)
      if (problems.length) throw invalid(`The report is not ready: ${problems.join('; ')}`)
      item.confidence = assess({
        sources: item.sources,
        conflict: item.confidence?.conflict,
        corroborated: true,
        baselineAt: ledger.baselineAt,
      })
      item.status = 'published'
      item.publishedAt = now()
      item.heldReasons = []
      item.reportId = item.reportId ?? `${item.id}-report`
      ledger.reports = ledger.reports.filter((r) => r.itemId !== item.id)
      const report = makeReport(item, sections, flag('by') ?? 'owner')
      ledger.reports.push(report)
      note(item, flag('by') ?? 'owner', flag('note') ?? 'published by hand')
      out.line(`published ${item.id}`)
      return { item, report, intel: ledger }
    }

    throw invalid(`Unknown intel action "${action}".`, 'See `./pw help intel`.')
  },
}

/** A shallow link check, for `show`. */
async function liveCheck(item) {
  const source = item.sources[0]
  if (!source) return null
  try {
    const res = await fetch(source.url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    return { status: res.status, final: res.url }
  } catch {
    return { status: 0, final: source.url }
  }
}

