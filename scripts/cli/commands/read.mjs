// Read-only commands: status, list, show, score, diff, check, doctor, fields.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { STABILITY, TRACKS } from '../../../lib/scoring.mjs';
import { CliError, invalid, notFound } from '../lib/errors.mjs';
import { ago, clip, isDate, pct, show as valueText, today } from '../lib/format.mjs';
import { loadState, preview, trackerAge, isWritable } from '../lib/data.mjs';
import { resolveProject, pick } from '../lib/resolve.mjs';
import { projectRow, rankOf, scoreView } from '../lib/score.mjs';
import { parseField, PATCH_FIELDS, ADDED_FIELDS } from '../lib/validate.mjs';
import { setField } from '../lib/mutate.mjs';

const run = promisify(execFile);

const sortRows = (rows, how) => {
  const by = {
    rank: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.rating - a.rating,
    rating: (a, b) => b.rating - a.rating,
    claimed: (a, b) => b.claimed - a.claimed,
    stars: (a, b) => (b.stars ?? -1) - (a.stars ?? -1),
    name: (a, b) => a.name.localeCompare(b.name),
  }[how];
  return rows.sort(by);
};

export const status = {
  summary: 'Where the data stands: counts, age, lapsed patches, leader.',
  async run({ out, flags }) {
    const state = await loadState(flags);
    const age = await trackerAge(state.paths.tracker);
    const efforts = state.effective.efforts;
    const publicCode = efforts.filter((e) => !projectRow(state, e).isPrivate);
    const top = [...efforts]
      .map((e) => projectRow(state, e))
      .filter((r) => !r.nuked)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
    if (state.lapsed.length) {
      out.warn(`${state.lapsed.length} patch(es) lapsed; run \`./pw check\` for the list.`);
    }
    if (age != null && age > 3600) out.warn(`tracker.json is ${ago(age)} old; the 15-minute sync may be stopped.`);
    const data = {
      tracker: { updated: state.tracker.updated, ageSeconds: age },
      counts: {
        projects: efforts.length,
        publicCode: publicCode.length,
        privateBuilds: efforts.length - publicCode.length,
        offline: efforts.filter((e) => e.nuked || e.stats?.missing).length,
        patches: state.overrides.patches.length,
        added: state.overrides.added.length,
        news: state.effective.news.length,
        candidates: state.effective.candidates.length,
      },
      lapsed: state.lapsed,
      pick: state.effective.pick ?? null,
      top,
    };
    out.line(out.paint(1, 'VIPortLive data'));
    out.line(`tracker     ${state.tracker.updated} (${ago(age)} old, upstream copy)`);
    out.line(`projects    ${efforts.length}: ${publicCode.length} public, ${efforts.length - publicCode.length} private, ${data.counts.offline} offline`);
    out.line(`overrides   ${state.overrides.patches.length} patches, ${state.overrides.added.length} added, ${state.effective.pick ? '1 pick' : 'no pick'}`);
    out.line(`inbox       ${state.effective.candidates.length} candidates, ${state.effective.news.length} articles`);
    out.line(`lapsed      ${state.lapsed.length}`);
    if (top.length) {
      out.line('');
      out.line(out.paint(1, 'Leader'));
      for (const row of top) {
        out.line(`  ${row.rating.toFixed(1).padStart(5)}  ${row.name} (${row.id}) — ${row.stage}${row.isPrivate ? ', private' : ''}`);
      }
    }
    return data;
  },
};

export const list = {
  summary: 'List projects with id, stage and both scores.',
  usage: '[--query text] [--stage key] [--status all|active|inactive|offline|private|unknown] [--code all|public|private] [--sort rank|rating|claimed|stars|name] [--limit n] [--all]',
  value: ['query', 'stage', 'status', 'code', 'sort', 'limit'],
  bool: ['all'],
  async run({ out, flags }) {
    const state = await loadState(flags);
    const q = (flags.query?.at(-1) ?? '').toLowerCase();
    const stage = flags.stage?.at(-1) ?? 'all';
    const status = flags.status?.at(-1) ?? 'all';
    const code = flags.code?.at(-1) ?? 'all';
    const sort = flags.sort?.at(-1) ?? 'rank';
    const limit = flags.all ? Number.POSITIVE_INFINITY : Number(flags.limit?.at(-1) ?? 40);
    if (!['rank', 'rating', 'claimed', 'stars', 'name'].includes(sort)) throw invalid(`Unknown sort "${sort}".`);
    if (!Number.isFinite(limit) || limit < 1) throw invalid('--limit must be a positive number.');

    let rows = state.effective.efforts.map((e) => projectRow(state, e));
    rows = rows.filter(
      (r) =>
        (!q || r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.repo?.toLowerCase().includes(q)) &&
        (stage === 'all' || r.stage === stage) &&
        (status === 'all' ||
          (status === 'offline' ? r.nuked || r.missing : status === 'private' ? r.isPrivate : !r.nuked && !r.missing && !r.isPrivate)) &&
        (code === 'all' || r.isPrivate === (code === 'private'))
    );
    rows = sortRows(rows, sort).slice(0, limit);
    out.table(
      rows.map((r) => [
        r.rank ?? '—',
        r.id,
        r.picked ? '*' : '',
        clip(r.name, 28),
        r.stage,
        r.rating.toFixed(1),
        r.claimed.toFixed(1),
        r.patched ? 'patch' : r.added ? 'added' : '',
        r.repo ?? 'private',
      ]),
      ['#', 'id', '', 'name', 'stage', 'rating', 'claimed', '', 'repo']
    );
    return { count: rows.length, projects: rows };
  },
};

export const show = {
  summary: 'Everything about one project: values, patch, score parts, evidence, findings.',
  usage: '<id>',
  async run({ out, flags }, [query]) {
    const state = await loadState(flags);
    const effort = resolveProject(state, query);
    const view = scoreView(state, effort);
    const rank = rankOf(state, effort.id);
    const patches = state.overrides.patches.filter((p) => p.id === effort.id);
    const added = state.overrides.added.find((a) => a.effort?.id === effort.id);
    if (patches.length) out.warn(`${patches.length} patch(es) apply to this project.`);
    out.line(out.paint(1, `${effort.name} (${effort.id})`));
    out.line(`${effort.tier}${effort.nuked ? ', offline' : ''}${view.private ? ', private build' : ` — ${effort.repo ?? 'no repo'}`}`);
    out.line(`${pct(view.claimed)} claimed, ${pct(view.rating)} ours, ${view.stage}, rank ${view.private ? '—' : rank.public}`);
    out.line('');
    out.line(out.paint(1, 'Claims'));
    for (const [key, value] of Object.entries(effort.gta ?? {})) out.line(`  gta.${key} = ${JSON.stringify(value)}`);
    out.line('');
    out.line(out.paint(1, 'Goals'));
    for (const goal of view.goals) {
      out.line(`  ${goal.label}: ${goal.met ? 'met' : 'not met'}`);
      for (const c of goal.checks) out.line(`    ${c.met ? 'yes' : 'no '} ${c.label} (${c.now}; ${c.url ?? `no proof.${c.key}`})`);
    }
    out.line('');
    out.line(out.paint(1, 'Score parts'));
    for (const part of view.parts) {
      out.line(`  ${part.label.padEnd(24)} ${part.claimed.toFixed(1).padStart(5)} claimed, ${part.counted.toFixed(1).padStart(5)} counted of ${part.max.toFixed(1)}${part.note ? ` (${part.note})` : ''}`);
    }
    out.line('');
    out.line(out.paint(1, 'Words'));
    out.line(`summary: ${effort.summary || '—'}`);
    out.line(`highlights: ${(effort.highlights ?? []).join(' | ') || '—'}`);
    out.line(`blockers: ${(effort.blockers ?? []).join(' | ') || '—'}`);
    out.line(`verification: ${effort.verification}, assessed ${effort.assessedAt ?? '—'} by ${effort.assessedBy ?? '—'}`);
    if (effort.findings?.length) {
      out.line('');
      out.line(out.paint(1, 'Findings'));
      effort.findings.forEach((f, i) => out.line(`  [${i}] ${f.text}${f.url ? ` <${f.url}>` : ''}`));
      if (effort.findingsSource) out.line(`  source note: ${effort.findingsSource}`);
    }
    if (patches.length || added) {
      out.line('');
      out.line(out.paint(1, added ? 'Added entry' : 'Our patch'));
      for (const patch of patches) {
        for (const [path, value] of Object.entries(patch.to)) {
          out.line(`  ${path}: ${JSON.stringify(patch.from[path])} → ${JSON.stringify(value)}`);
        }
        for (const change of patch.changes ?? []) out.line(`  change ${change.date} (${change.kind}): ${change.text}`);
      }
      if (added) {
        for (const change of added.changes ?? []) out.line(`  change ${change.date} (${change.kind}): ${change.text}`);
      }
    }
    if (state.lapsed.some((l) => l.id === effort.id)) out.warn('A patch for this project lapsed; see `./pw check`.');
    return { project: effort, view, rank, patches, added: Boolean(added) };
  },
};

export const score = {
  summary: 'Show the arithmetic, optionally for values you have not saved yet.',
  usage: '<id> [--set field=value]...',
  value: ['set'],
  async run({ out, flags }, [query]) {
    const state = await loadState(flags);
    const effort = resolveProject(state, query);
    const draft = structuredClone(state.overrides);
    let open = null;
    for (const pair of flags.set ?? []) {
      const eq = pair.indexOf('=');
      if (eq < 1) throw invalid(`--set needs field=value, not "${pair}".`);
      const result = setField(state, draft, effort.id, pair.slice(0, eq), pair.slice(eq + 1), { reuse: open });
      if (result.patch) open = result.patch;
    }
    const effective = preview(state, draft);
    const next = effective.efforts.find((e) => e.id === effort.id);
    const before = scoreView(state, effort);
    const after = scoreView(state, next);
    const rank = rankOf(state, effort.id, effective.efforts);
    const delta = Math.round((after.rating - before.rating) * 10) / 10;
    out.line(`${effort.name}: ${pct(before.claimed)} claimed, ${pct(before.rating)} ours`);
    if (delta !== 0 || after.stage !== before.stage) {
      out.line(
        `${out.paint(delta >= 0 ? 32 : 31, `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`)} → ${pct(after.rating)}, ${after.stage}${after.private ? '' : `, rank ${rank.public}`}`
      );
    }
    for (const part of after.parts) {
      out.line(`  ${part.label.padEnd(24)} ${part.claimed.toFixed(1).padStart(5)} claimed, ${part.counted.toFixed(1).padStart(5)} counted of ${part.max.toFixed(1)}${part.note ? ` (${part.note})` : ''}`);
    }
    return { project: effort.id, before, after, delta, rank };
  },
};

export const diff = {
  summary: 'Show everything our overrides change against upstream.',
  async run({ out, flags }) {
    const state = await loadState(flags);
    const data = {
      patches: state.overrides.patches.map((p) => ({ id: p.id, changes: p.to })),
      added: state.overrides.added.map((a) => a.effort?.id),
      news: (state.overrides.news ?? []).map((n) => n.id),
      removedNews: state.overrides.removedNews ?? [],
      ignored: (state.overrides.ignored ?? []).map((i) => i.repo),
      decided: state.overrides.decided ?? [],
      pick: state.overrides.pick ?? null,
      lapsed: state.lapsed,
    };
    out.line(out.paint(1, `${data.patches.length} patches, ${data.added.length} added, ${data.news.length} articles, ${data.ignored.length} ignored`));
    for (const p of state.overrides.patches) {
      const lapsed = state.lapsed.some((l) => l.id === p.id);
      out.line(`${lapsed ? out.paint(31, 'LAPSED') : out.paint(32, 'holds ')} ${p.id}`);
      for (const [path, value] of Object.entries(p.to)) {
        out.line(`  ${path}: ${clip(valueText(p.from[path]), 60)} → ${clip(valueText(value), 60)}`);
      }
    }
    for (const id of data.added) out.line(`${out.paint(32, 'added ')} ${id}`);
    if (data.pick) out.line(`pick: ${data.pick.id} (${data.pick.reason})`);
    return data;
  },
};

export const fields = {
  summary: 'List the editable field names and their rules.',
  async run({ out }) {
    out.line(out.paint(1, 'Patches (upstream projects)'));
    out.line([...PATCH_FIELDS].sort().join('\n'));
    out.line('');
    out.line(out.paint(1, 'Added projects only'));
    out.line([...ADDED_FIELDS].filter((f) => !PATCH_FIELDS.has(f)).sort().join('\n'));
    out.line('');
    out.line(`gta.story steps: ${TRACKS.find((t) => t.key === 'story').steps.map((s) => s.v).join(', ')}`);
    out.line(`gta.render steps: ${TRACKS.find((t) => t.key === 'render').steps.map((s) => s.v).join(', ')}`);
    out.line(`gta.stability: ${Object.keys(STABILITY).join(', ')} or 0 to 1`);
    return { patch: [...PATCH_FIELDS].sort(), addedOnly: [...ADDED_FIELDS].filter((f) => !PATCH_FIELDS.has(f)).sort() };
  },
};

export const NEWS_CATEGORIES = ['Leak', 'Takedown', 'Legal', 'Security', 'Official', 'Port', 'Safety'];

export function newsIssues(article, where, seen, { strict = false } = {}) {
  const issues = [];
  const bad = (message) => issues.push({ level: strict ? 'error' : 'warn', code: 'bad_news', where, message });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(article.id ?? '')) bad('id is lowercase letters, digits and hyphens.');
  if (seen.has(article.id)) bad(`id "${article.id}" is used twice.`);
  seen.add(article.id);
  if (!isDate(article.date)) bad('date is YYYY-MM-DD.');
  if (!NEWS_CATEGORIES.includes(article.category)) bad(`category is one of ${NEWS_CATEGORIES.join(', ')}.`);
  if (!article.title || article.title.length > 90) bad('title is 1 to 90 characters.');
  if (!article.dek) bad('dek is required.');
  if (!Array.isArray(article.body) || article.body.length < 2 || article.body.length > 5) bad('body has 2 to 5 paragraphs.');
  const count = (article.body ?? []).join(' ').split(/\s+/).filter(Boolean).length;
  if (count < 120 || count > 220) bad(`body is ${count} words; the playbook asks for 120 to 220.`);
  if (!Array.isArray(article.sources) || article.sources.length === 0) bad('at least one source is required.');
  for (const source of article.sources ?? []) {
    if (!source.outlet || !source.title) bad('each source needs outlet and title.');
    if (!/^https:\/\//.test(source.url ?? '')) bad(`source URL is not https: ${source.url}`);
  }
  if (article.image && (!article.image.url || !article.image.credit || !article.image.link)) {
    bad('an image needs url, credit and link.');
  }
  if (strict && !['claude', 'report', 'owner'].includes(article.by)) bad('by is claude, report or owner.');
  if (article.image && /x\.com|twitter\.com|discord/.test(`${article.image.url} ${article.image.link}`)) {
    issues.push({ level: 'warn', code: 'image_rule', where, message: 'X/Discord image: it must not be a leaked-game or Discord screenshot; null is safer.' });
  }
  return issues;
}

export const check = {
  summary: 'Validate the overrides, lapsed patches, articles and tracker integrity.',
  async run({ out, flags }) {
    const state = await loadState(flags);
    const issues = [];
    const problem = (level, code, where, message) => issues.push({ level, code, where, message });

    for (const l of state.lapsed) problem('error', 'lapsed', l.id, `override lapsed: ${l.why}`);
    const ids = new Set(state.effective.efforts.map((e) => e.id));
    for (const patch of state.overrides.patches) {
      if (!patch.id || !patch.from || !patch.to) problem('error', 'bad_patch', patch.id ?? '?', 'patch needs id, from and to.');
      if (patch.id && !state.tracker.efforts.some((e) => e.id === patch.id)) {
        problem('error', 'orphan_patch', patch.id, 'upstream no longer lists this project.');
      }
      for (const path of Object.keys(patch.from ?? {})) {
        if (!PATCH_FIELDS.has(path)) problem('error', 'bad_field', patch.id, `from has unknown field "${path}".`);
      }
      for (const path of Object.keys(patch.to ?? {})) {
        if (!PATCH_FIELDS.has(path)) problem('error', 'bad_field', patch.id, `to has unknown field "${path}".`);
        try {
          const value = patch.to[path];
          parseField(path, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (err) {
          const level = /written steps/.test(err.message) ? 'warn' : 'error';
          problem(level, 'bad_value', patch.id, `${path}: ${err.message}`);
        }
      }
    }
    const added = new Set();
    for (const entry of state.overrides.added) {
      const item = entry.effort;
      const id = item?.id;
      if (!id || !item) problem('error', 'bad_added', id ?? '?', 'added entry needs an effort with an id.');
      if (id && added.has(id)) problem('error', 'duplicate_id', id, 'two added entries use this id.');
      if (id) added.add(id);
      if (!item) continue;
      for (const field of ['name', 'summary', 'gta', 'stats', 'tier', 'verification', 'blockers']) {
        if (item[field] == null) problem('error', 'bad_added', id, `added effort needs ${field}.`);
      }
      if (item.repo && !item.repo.includes('/')) problem('error', 'bad_added', id, 'repo must be owner/name.');
      for (const [path, value] of Object.entries(item)) {
        if (!ADDED_FIELDS.has(path)) {
          if (!['id', 'claims', 'changes'].includes(path)) {
            problem('warn', 'unknown_field', id, `added effort has unknown field "${path}".`);
          }
          continue;
        }
        try {
          parseField(path, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (err) {
          problem(/written steps/.test(err.message) ? 'warn' : 'error', 'bad_value', id, `${path}: ${err.message}`);
        }
      }
    }
    if (state.overrides.pick && !ids.has(state.overrides.pick.id)) {
      problem('error', 'bad_pick', state.overrides.pick.id, 'pick names no project.');
    }
    for (const item of state.overrides.ignored ?? []) {
      if (!item.repo || !item.reason) problem('error', 'bad_ignored', item.repo ?? '?', 'ignored needs repo and reason.');
    }
    const seenNews = new Set();
    const upstreamNews = new Set(state.tracker.news.map((n) => n.id));
    for (const article of state.overrides.news ?? []) {
      issues.push(...newsIssues(article, article.id ?? '?', seenNews, { strict: !upstreamNews.has(article.id) }));
    }
    const shadowed = new Set((state.overrides.news ?? []).map((n) => n.id));
    for (const article of state.tracker.news) {
      if (shadowed.has(article.id) || (state.overrides.removedNews ?? []).includes(article.id)) continue;
      issues.push(...newsIssues(article, article.id ?? '?', seenNews));
    }
    for (const id of state.overrides.removedNews ?? []) {
      if (!state.tracker.news.some((n) => n.id === id)) problem('warn', 'orphan_removed_news', id, 'removed article is not in upstream news.');
    }
    for (const e of state.effective.efforts) {
      const score = scoreView(state, e);
      if (!Number.isFinite(score.claimed) || score.claimed < 0 || score.claimed > 100) {
        problem('error', 'bad_score', e.id, `score is ${score.claimed}.`);
      }
      if (e.gta?.story > 0 && !e.gta?.playable) problem('warn', 'story_before_playable', e.id, 'story is above 0 but playable is not 1.');
      for (const [key, value] of Object.entries(e.gta ?? {})) {
        if (!['loads', 'boots', 'menu', 'world', 'playable', 'story', 'render', 'fps', 'stability'].includes(key)) {
          problem('warn', 'unknown_field', e.id, `gta has unknown field "${key}".`);
          continue;
        }
        try {
          parseField(`gta.${key}`, typeof value === 'string' ? value : String(value));
        } catch (err) {
          problem(/written steps/.test(err.message) ? 'warn' : 'error', 'bad_value', e.id, `gta.${key}: ${err.message}`);
        }
      }
    }

    const dirty = await run('git', ['-C', state.root, 'diff', '--quiet', '--', 'data/tracker.json']).then(
      () => false,
      () => true
    );
    if (dirty) problem('warn', 'tracker_dirty', 'data/tracker.json', 'tracker.json has local changes; the next sync overwrites it.');
    if ((await trackerAge(state.paths.tracker)) > 7200) problem('warn', 'stale', 'data/tracker.json', 'tracker is over two hours old.');

    const errors = issues.filter((i) => i.level === 'error');
    for (const issue of issues) out.line(`${issue.level === 'error' ? out.paint(31, 'error') : out.paint(33, 'warn ')} ${issue.where}: ${issue.message}`);
    out.line(`${errors.length} error(s), ${issues.length - errors.length} warning(s).`);
    if (errors.length) {
      throw new CliError('check_failed', `${errors.length} validation error(s).`, { data: { issues }, exit: 3 });
    }
    return { ok: true, issues, date: today() };
  },
};

export const doctor = {
  summary: 'Check the toolchain, data files and git identity.',
  async run({ out, flags }) {
    const state = await loadState(flags);
    const issues = [];
    const add = (level, name, detail) => issues.push({ level, name, detail });
    const major = Number(process.versions.node.split('.')[0]);
    add(major >= 22 ? 'ok' : 'error', 'node', `v${process.versions.node}${major >= 22 ? '' : ', needs 22 or newer'}`);
    add('ok', 'data', state.paths.dataDir);
    add((await isWritable(state.paths.dataDir)) ? 'ok' : 'error', 'writable', state.paths.dataDir);
    const age = await trackerAge(state.paths.tracker);
    add(age != null && age < 7200 ? 'ok' : 'warn', 'tracker age', `${ago(age)} old`);
    const email = await run('git', ['-C', state.root, 'config', 'user.email']).then((r) => r.stdout.trim(), () => '');
    add(email.endsWith('+4lwayz@users.noreply.github.com') || email.endsWith('@users.noreply.github.com') ? 'ok' : 'warn', 'git email', email || 'not set');
    add('ok', 'overrides', `${state.overrides.patches.length} patches, ${state.overrides.added.length} added`);
    add(state.lapsed.length === 0 ? 'ok' : 'warn', 'lapsed', String(state.lapsed.length));
    for (const issue of issues) {
      out.line(`${issue.level === 'ok' ? out.paint(32, 'ok  ') : issue.level === 'warn' ? out.paint(33, 'warn') : out.paint(31, 'fail')} ${issue.name}: ${issue.detail}`);
    }
    return { issues };
  },
};

export const schema = {
  summary: 'Machine-readable field rules for patches, articles and added projects.',
  usage: '[patch|article|effort|all]',
  async run({ out }, [kind = 'all']) {
    const patch = {
      'gta.loads|boots|menu|world|playable': 'number 0, 0.5 or 1',
      'gta.story': TRACKS.find((t) => t.key === 'story').steps.map((s) => s.v),
      'gta.render': TRACKS.find((t) => t.key === 'render').steps.map((s) => s.v),
      'gta.fps': 'number 0-240',
      'gta.stability': [...Object.keys(STABILITY), 'or number 0-1'],
      'proof.fps|render|story': 'https link or null; what the Playable and Story beaten goals need',
      summary: 'string, under 700 characters',
      highlights: 'string[], max 3, each under 20 words',
      blockers: 'string[], max 3, each under 20 words',
      verification: ['self-reported', 'reproduced'],
      manualScore: 'number 0-100 or null',
      assessedAt: 'YYYY-MM-DD',
      assessedBy: 'string',
      findings: '{ text, url? }[]; url https',
      findingsSource: 'string or null',
      tier: ['tracked', 'watchlist'],
      related: 'string[] of repos',
      basedOn: 'string[] of effort ids',
    };
    const article = {
      required: ['title', 'dek', 'category', 'date', 'body', 'sources', 'by'],
      title: 'string, 1-90 characters',
      dek: 'string, 1-240 characters',
      category: NEWS_CATEGORIES,
      date: 'YYYY-MM-DD',
      body: 'string[], 2-5 paragraphs, 120-220 words total',
      sources: '{ outlet, title, url }[], url https, at least 1',
      image: '{ url, credit, link } or null',
      by: ['claude', 'report', 'owner'],
      id: 'lowercase letters, digits and hyphens; unique forever',
    };
    const effort = {
      required: ['id', 'name', 'summary', 'gta', 'stats', 'tier', 'verification', 'blockers'],
      id: 'kebab-case, unique',
      repo: 'owner/name or null for a private build',
      stats: 'object; copied from the candidate by `candidate track`',
      plus: 'every patch field',
    };
    const data = kind === 'all' ? { patch, article, effort } : { [kind]: { patch, article, effort }[kind] ?? null };
    if (kind !== 'all' && !data[kind]) throw invalid(`Unknown schema "${kind}".`);
    out.line(JSON.stringify(data, null, 2));
    return data;
  },
};

export const resolve = { resolveProject, pick };
