// The detector. Reads the files the harvest and scout already wrote, forward from each source cursor,
// and turns meaningful changes into ledger items. Pure: no network.
import { createHash } from 'node:crypto'
import { assess, eventKey, chainOf, compact } from '../../../lib/intel-gate.mjs'
import { DUPLICATE_AT, fingerprintOf, similarity } from './fingerprint.mjs'

const SIGNAL =
  /\b(playable|gameplay|in[- ]game|open world|prologue|first mission|menu|boot|first frame|fps|frame ?rate|crash|controller|shader|render|world|save)\b/i
const LEAK = /\b(leak|leaked|executable|\.exe|download|build)\b/i
const REPOST_AT = 0.92
const MAX_PER_SOURCE = 12
const NEW = new Set(['new'])
const REMOVED = new Set(['removed'])

const clean = (text, max = 240) =>
  String(text ?? '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const authorHash = (value) =>
  value ? createHash('sha256').update(String(value)).digest('hex').slice(0, 10) : null

const isGithubProject = (url, repo) =>
  Boolean(repo) && url.toLowerCase().includes(`/${repo.toLowerCase()}/`) && hostOf(url) === 'github.com'

const clipTitle = (text, max = 90) => {
  const line = clean(text, max + 20)
  return line.length <= max ? line : `${line.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

/** Efforts by longest name and id, so "Victory AMD" wins over "Victory". */
function resolver(efforts) {
  const list = [...efforts]
    .filter((e) => e.name && e.id)
    .sort((a, b) => b.name.length - a.name.length)
  const patterns = list.map((e) => ({
    effort: e,
    match: new RegExp(`(?:^|[^\\w-])(?:${[e.name, e.id].map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'i'),
  }))
  return (text, url = '') => {
    for (const e of list) {
      if (e.repo && isGithubProject(url, e.repo)) return e
    }
    for (const { effort, match } of patterns) {
      if (match.test(text)) return effort
    }
    return null
  }
}

const sameTitle = (a, b) => {
  const words = (s) => new Set(clean(s, 400).toLowerCase().split(' ').filter((w) => w.length > 3))
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const w of A) if (B.has(w)) shared++
  return shared / Math.max(A.size, B.size)
}

const newer = (at, cursor) => Number.isFinite(Date.parse(at ?? '')) && Date.parse(at) > Date.parse(cursor)

/** Deduplicates within one item: the same headline from several outlets is one voice. */
function sourceList(sources) {
  const seen = new Set()
  const out = []
  for (const source of sources) {
    if (!/^https:\/\//.test(source.url ?? '')) continue
    const key = source.url.replace(/#.*$/, '')
    if (seen.has(key)) continue
    const repost = out.find((s) => sameTitle(s.title, source.title) >= REPOST_AT)
    if (repost) source.kind = 'repost'
    seen.add(key)
    out.push(source)
  }
  return out.slice(0, 12)
}

function makeItem({ kind, project, at, detectedAt, title, oneLine, sources, fingerprint, keyText = '', corroborated = false, sensitive = false, conflicts = false, baseline }) {
  const list = sourceList(sources)
  const primary = project?.repo
    ? list.some((s) => s.kind === 'primary' || isGithubProject(s.url, project.repo))
    : false
  return {
    id: `${compact(at)}-${project?.id ?? 'scene'}-${createHash('sha256').update(eventKey({ kind, projectId: project?.id, keyText, url: list[0]?.url, at })).digest('hex').slice(0, 8)}`,
    key: eventKey({ kind, projectId: project?.id, keyText, url: list[0]?.url, at }),
    kind,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    at,
    detectedAt,
    title,
    oneLine,
    sources: list,
    fingerprint,
    similar: [],
    confidence: assess({
      sources: list,
      conflict: conflicts,
      corroborated: corroborated || primary,
      now: Date.parse(detectedAt),
      baselineAt: baseline,
    }),
    status: 'observed',
    sensitive,
    audit: null,
    chain: '',
    reportId: null,
    discordAt: null,
    revisions: [],
  }
}

/** The item's own fingerprint, from its title and one line, for later duplicate checks. */
const itemPrint = (project, title, text) => ({
  ...fingerprintOf({ repo: project?.repo ?? null, name: project?.name ?? '', id: project?.id ?? '', summary: text, readme: title }),
  projectId: project?.id ?? null,
})

export function detect({ tracker, evidence, milestones, activity, news, intel, failures = [], now = new Date().toISOString() }) {
  const cursor = (source, fallback) => intel.coverage?.[source]?.lastCursor ?? fallback
  const baselineAt = intel.baselineAt ?? new Date(Date.parse(now) - 36e5).toISOString()
  const resolve = resolver(tracker.efforts)
  const byId = new Map(tracker.efforts.map((e) => [e.id, e]))
  const items = []
  const coverage = structuredClone(intel.coverage ?? {})
  const errors = []

  const track = (source) => {
    coverage[source] ??= { lastCursor: baselineAt, lastOkAt: null, seen: 0, events: 0, errors: 0 }
    return coverage[source]
  }
  const done = (source, seen, maxAt) => {
    const row = track(source)
    row.seen += seen
    row.lastOkAt = now
    const floor = Date.parse(now) - 12 * 36e5
    const next = maxAt && Number.isFinite(Date.parse(maxAt)) ? Date.parse(maxAt) : 0
    row.lastCursor = new Date(Math.max(Date.parse(row.lastCursor ?? 0), next, floor)).toISOString()
  }
  const push = (source, item) => {
    if (!item) return
    items.push(item)
    track(source).events++
  }

  /* ---------- Evidence: a tester reached or failed a stage ---------- */
  const evidenceCursor = cursor('evidence', baselineAt)
  const readings = (evidence.items ?? []).filter((e) => newer(e.at, evidenceCursor) && byId.has(e.effortId))
  const groups = new Map()
  for (const reading of readings) {
    const key = `${reading.effortId}|${reading.stage}|${Math.floor(Date.parse(reading.at) / 36e5)}`
    const group = groups.get(key) ?? []
    group.push(reading)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    const first = group[0]
    const project = byId.get(first.effortId)
    const reached = group.filter((r) => r.outcome === 'reached')
    const failed = group.filter((r) => r.outcome === 'failed')
    const latest = group.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
    const kind = reached.length ? 'evidence' : 'claim'
    const label = reached.length ? 'test evidence' : 'failed report'
    push(
      'evidence',
      makeItem({
        kind,
        project,
        at: latest.at,
        detectedAt: now,
        title: `New ${label} on ${project.name}${group.length > 1 ? ` (${group.length} reports)` : ''} — ${first.stage}`,
        oneLine: clean(reached[0]?.quote ?? failed[0]?.quote ?? `${project.name} was reported at ${first.stage}.`),
        sources: group.map((r) => ({
          url: r.url,
          host: hostOf(r.url),
          outlet: 'GitHub',
          title: clean(r.quote, 120) || `Report on ${r.stage}`,
          at: r.at,
          kind: isGithubProject(r.url, project.repo) ? 'primary' : 'outside',
          authorHash: r.by,
          excerpt: clean(r.quote, 500),
        })),
        keyText: first.stage,
        fingerprint: itemPrint(project, `${project.name} ${first.stage}`, group.map((r) => r.quote).join(' ')),
        corroborated: reached.length > 0,
        conflicts: reached.length > 0 && failed.length > 0,
        baseline: baselineAt,
      })
    )
  }
  done('evidence', readings.length, readings.map((r) => r.at).sort().at(-1))

  /* ---------- Milestones: a stage moved ---------- */
  const milestoneCursor = cursor('milestones', baselineAt)
  for (const m of (milestones ?? []).filter((m) => newer(m.at, milestoneCursor) && byId.has(m.id))) {
    if (m.stageTo === m.stageFrom && Math.abs(m.to - m.from) < 2) continue
    const project = byId.get(m.id)
    const source = {
      url: project.repo ? `https://github.com/${project.repo}` : `https://viportlive.com/projects/${project.id}`,
      host: hostOf(project.repo ? `https://github.com/${project.repo}` : 'https://viportlive.com'),
      outlet: project.repo ? 'Project repository' : 'VIPortLive',
      title: `${project.name} record`,
      at: m.at,
      kind: 'primary',
    }
    push(
      'milestones',
      makeItem({
        kind: 'update',
        project,
        at: m.at,
        detectedAt: now,
        title: m.stageTo !== m.stageFrom ? `${project.name} moved to ${m.stageTo}` : `${project.name} gained ${Math.round((m.to - m.from) * 10) / 10} points`,
        oneLine: `The project’s record moved from ${m.from}% to ${m.to}%.`,
        sources: [source],
        keyText: m.stageTo,
        fingerprint: itemPrint(project, m.stageTo, `milestone ${m.stageTo}`),
        corroborated: m.stageTo !== m.stageFrom,
        baseline: baselineAt,
      })
    )
  }
  done('milestones', (milestones ?? []).length, (milestones ?? []).map((m) => m.at).sort().at(-1))

  /* ---------- New public repositories ---------- */
  const activityCursor = cursor('activity', baselineAt)
  for (const repo of (activity.discovered ?? []).filter((r) => newer(r.pushedAt, activityCursor)).slice(0, MAX_PER_SOURCE)) {
    const project = resolve(`${repo.repo} ${repo.description}`)
    push(
      'activity',
      makeItem({
        kind: project ? 'reference' : 'reference',
        project,
        at: repo.pushedAt,
        detectedAt: now,
        title: project ? `New reference to ${project.name}` : `New public repository: ${repo.repo}`,
        oneLine: clean(repo.description || `${repo.stars} stars, ${repo.language ?? 'unknown language'}.`),
        sources: [
          {
            url: repo.url,
            host: 'github.com',
            outlet: 'GitHub',
            title: repo.repo,
            at: repo.pushedAt,
            kind: project ? 'primary' : 'official',
          },
        ],
        keyText: 'activity',
        fingerprint: itemPrint(project, repo.repo, repo.description),
        baseline: baselineAt,
      })
    )
  }

  /* ---------- Commits and pull requests, grouped ---------- */
  const feed = (activity.feed ?? []).filter((f) => newer(f.at, activityCursor))
  for (const repo of new Set(feed.map((f) => f.projectId))) {
    const project = byId.get(repo)
    if (!project) continue
    const rows = feed
      .filter((f) => f.projectId === repo)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    const pulled = rows.filter((f) => 'number' in f)
    const commits = rows.filter((f) => !('number' in f))
    const spoken = commits.filter((c) => SIGNAL.test(c.message))
    if (!pulled.length && !spoken.length) continue
    const latest = rows[0]
    const sourceRow = pulled[0] ?? spoken[0]
    push(
      'activity',
      makeItem({
        kind: 'update',
        project,
        at: latest.at,
        detectedAt: now,
        title:
          pulled.length && 'number' in sourceRow
            ? `${project.name} opened pull request #${sourceRow.number}`
            : `${project.name} pushed ${commits.length || 1} commit${commits.length === 1 ? '' : 's'}`,
        oneLine: clean(('number' in sourceRow ? sourceRow.title : sourceRow.message) || latest.message),
        sources: [
          {
            url: sourceRow.url,
            host: 'github.com',
            outlet: 'GitHub',
            title: clean(('number' in sourceRow ? sourceRow.title : sourceRow.message) || 'Code change', 120),
            at: sourceRow.at,
            kind: 'primary',
          },
        ],
        keyText: 'activity',
        fingerprint: itemPrint(project, 'commit', spoken.map((c) => c.message).join(' ')),
        baseline: baselineAt,
      })
    )
  }
  done('activity', (activity.feed ?? []).length, [...(activity.feed ?? []), ...(activity.discovered ?? []).map((r) => ({ at: r.pushedAt }))].map((r) => r.at).sort().at(-1))

  /* ---------- News and takedowns ---------- */
  const newsCursor = cursor('news', baselineAt)
  for (const story of (news.items ?? []).filter((n) => newer(n.date, newsCursor)).slice(0, MAX_PER_SOURCE * 2)) {
    const project = resolve(`${story.title} ${story.outlet}`, story.url)
    const takedown = /takedown|taken down|dmca|nuked/i.test(`${story.category} ${story.title}`)
    const claim = SIGNAL.test(story.title) || LEAK.test(story.title) || takedown
    if (!project && !takedown) continue
    if (!claim) continue
    const at = story.date
    push(
      'news',
      makeItem({
        kind: takedown ? 'takedown' : 'claim',
        project,
        at,
        detectedAt: now,
        title: takedown
          ? `${project?.name ?? story.outlet} in a takedown report`
          : project
            ? `New claim about ${project.name}`
            : clipTitle(story.title),
        oneLine: clipTitle(story.title),
        sources: [
          {
            url: story.url,
            host: hostOf(story.url),
            outlet: story.outlet,
            title: clipTitle(story.title, 120),
            at,
            kind: 'outside',
            authorHash: authorHash(story.outlet),
            excerpt: clean(story.title, 500),
          },
        ],
        fingerprint: itemPrint(project, story.title, story.title),
        sensitive: LEAK.test(story.title) || story.category === 'Leak',
        baseline: baselineAt,
      })
    )
  }
  done('news', (news.items ?? []).length, (news.items ?? []).map((n) => n.date).sort().at(-1))

  /* ---------- Tracker changes and nukes ---------- */
  const trackerCursor = cursor('tracker', baselineAt)
  for (const change of (tracker.changes ?? []).filter((c) => newer(c.date, trackerCursor)).slice(0, MAX_PER_SOURCE)) {
    const project = resolve(change.text)
    if (!project) continue
    const removed = REMOVED.has(change.kind) || /no longer reachable|taken down/i.test(change.text)
    push(
      'tracker',
      makeItem({
        kind: removed ? 'takedown' : NEW.has(change.kind) ? 'reference' : 'update',
        project,
        at: new Date(change.date).toISOString(),
        detectedAt: now,
        title: removed ? `${project.name} went unreachable` : `${project.name} changed on the board`,
        oneLine: clean(change.text),
        sources: [
          {
            url: project.repo ? `https://github.com/${project.repo}` : `https://viportlive.com/projects/${project.id}`,
            host: project.repo ? 'github.com' : 'viportlive.com',
            outlet: 'Project record',
            title: clean(change.text, 120),
            at: new Date(change.date).toISOString(),
            kind: 'primary',
            excerpt: clean(change.text, 500),
          },
        ],
        keyText: 'tracker',
        fingerprint: itemPrint(project, 'change', change.text),
        sensitive: /executable|leak/i.test(change.text),
        baseline: baselineAt,
      })
    )
  }
  done('tracker', (tracker.changes ?? []).length, (tracker.changes ?? []).map((c) => c.date).sort().at(-1))

  /* ---------- Duplicate references ---------- */
  const reference = items.filter((i) => i.kind === 'reference')
  for (const item of reference) {
    const candidates = [
      ...(intel.baseline?.entries ?? []),
      ...intel.items.filter((i) => i.fingerprint).slice(-200).map((i) => i.fingerprint),
    ]
    for (const other of candidates) {
      if ((other.projectId ?? other.effortId) === item.projectId) continue
      const score = similarity(item.fingerprint, other)
      if (score >= DUPLICATE_AT) item.similar.push({ effortId: other.effortId ?? other.projectId ?? 'unknown', score })
    }
    item.similar.sort((a, b) => b.score - a.score)
    item.similar = item.similar.slice(0, 3)
    if (item.similar.length && item.similar[0].score >= DUPLICATE_AT) {
      item.kind = 'duplicate'
      item.title = `${item.projectName ?? 'A new repository'} may duplicate ${item.similar[0].effortId}`
    }
  }

  /* ---------- Coverage and gaps ---------- */
  for (const source of ['activity', 'evidence', 'milestones', 'news', 'tracker']) {
    const row = track(source)
    const stale = failures.includes(source) || !row.lastOkAt || Date.parse(now) - Date.parse(row.lastOkAt) > 30 * 60e3
    const open = [...(intel.items ?? []), ...items].find(
      (i) => i.kind === 'ingest-gap' && i.status === 'held' && i.projectId === source
    )
    if (stale && !open) {
      push(
        source,
        makeItem({
          kind: 'ingest-gap',
          project: { id: source, name: source, repo: null, summary: '' },
          at: now,
          detectedAt: now,
          title: `Source gap: ${source}`,
          oneLine: `${source} has not answered for more than two runs.`,
          sources: [],
          fingerprint: itemPrint(null, 'gap', source),
          baseline: baselineAt,
        })
      )
      errors.push(source)
    }
  }
  return { items, coverage, errors }
}
