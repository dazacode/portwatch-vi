// Writing commands: set, find, pick, news, candidate. Each edits a draft the runner may save.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { applyPatch, getPath } from '../../../lib/overrides.mjs';
import { patchesFor, resolveProject } from '../lib/resolve.mjs';
import { draft, loadState, preview } from '../lib/data.mjs';
import { addChange, setField } from '../lib/mutate.mjs';
import { invalid, notFound } from '../lib/errors.mjs';
import { clip, isDate, pct, slug, stageIndex, today } from '../lib/format.mjs';
import { ADDED_FIELDS, ladderWarning, parseField } from '../lib/validate.mjs';
import { rankOf, scoreView } from '../lib/score.mjs';
import { NEWS_CATEGORIES, newsIssues } from './read.mjs';

const pairs = (values, map) =>
  values.map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 1) throw invalid(`Expected field=value, not "${pair}".`);
    return map(pair.slice(0, eq), pair.slice(eq + 1));
  });

export const set = {
  summary: 'Set claim fields on a project, with a score preview and a change line.',
  usage: '<id> field=value... [--change text] [--kind up|down|new] [--by claude|manual] [--no-assessed] [--rebase]',
  value: ['change', 'kind', 'by'],
  bool: ['rebase', 'assessed'],
  async run({ out, flags }, [query, ...assignments]) {
    if (!query || assignments.length === 0) throw invalid('Use `./pw set <id> field=value...`.');
    const state = await loadState(flags);
    const effort = resolveProject(state, query);
    const overrides = draft(state);
    const changes = [];
    const before = scoreView(state, effort);
    const by = flags.by?.at(-1) ?? 'claude';
    if (!['claude', 'manual'].includes(by)) throw invalid('--by is claude or manual.');
    let open = null;

    for (const [field, raw] of pairs(assignments, (f, v) => [f, v])) {
      const result = setField(state, overrides, effort.id, field, raw, {
        force: Boolean(flags.force),
        rebase: Boolean(flags.rebase),
        reuse: open,
      });
      if (result.patch) open = result.patch;
      const warning = result.noop ? null : ladderWarning(field, result.after);
      if (warning) out.warn(warning);
      out.line(`${result.noop ? 'same  ' : out.paint(32, 'set   ')} ${field}: ${clip(JSON.stringify(result.before), 45)} → ${clip(JSON.stringify(result.after), 45)}`);
      if (!result.noop) changes.push(result.change);
    }

    if (changes.length === 0) {
      out.line('Nothing changed.');
      return { project: effort.id, changes, noop: true };
    }

    if (flags.assessed !== false && !flags['no-assessed']) {
      setField(state, overrides, effort.id, 'assessedAt', today(), { force: true, reuse: open });
      setField(state, overrides, effort.id, 'assessedBy', by, { force: true, reuse: open });
    }

    const effective = preview(state, overrides);
    const next = effective.efforts.find((e) => e.id === effort.id);
    const after = scoreView(state, next);
    const delta = Math.round((after.rating - before.rating) * 10) / 10;
    const movedStage = stageIndex(after.reached) !== stageIndex(before.reached);
    const text = flags.change?.at(-1);
    const auto = text ?? (Math.abs(after.claimed - before.claimed) >= 0.5 || movedStage
      ? `${effort.name}: ${changes.map((c) => c.path).join(', ')} changed; score ${pct(before.claimed)} → ${pct(after.claimed)}${movedStage ? `, ${after.stage}` : ''}.`
      : null);
    const kind = flags.kind?.at(-1) ?? (after.claimed < before.claimed ? 'down' : movedStage ? 'new' : 'up');
    if (!['up', 'down', 'new', 'claim', 'removed'].includes(kind)) throw invalid('--kind is up, down, new, claim or removed.');
    if (auto) addChange(overrides, effort.id, kind, auto);
    out.line(`${pct(before.rating)} → ${out.paint(delta >= 0 ? 32 : 31, `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`)} = ${pct(after.rating)} (${after.stage})`);
    if (text) out.line(`change: ${text}`);
    return {
      project: effort.id,
      changes,
      before,
      after,
      delta,
      change: auto,
      rank: rankOf(state, effort.id, effective.efforts),
      overrides,
    };
  },
};

export const rebase = {
  summary: 'Move a lapsed patch onto the values upstream has now, keeping ours.',
  usage: '<id>',
  async run({ out, flags }, [query]) {
    const state = await loadState(flags);
    const effort = resolveProject(state, query);
    const overrides = draft(state);
    const patches = patchesFor(overrides, effort.id);
    if (!patches.length) throw invalid(`${effort.id} has no patch to rebase.`);
    const raw = state.tracker.efforts.find((e) => e.id === effort.id);
    if (!raw) throw invalid(`${effort.id} is an added project; it needs no rebase.`);
    let current = raw;
    const changes = [];
    for (const patch of patches) {
      for (const path of Object.keys(patch.from)) {
        const now = structuredClone(getPath(current, path) ?? null);
        if (JSON.stringify(now) === JSON.stringify(patch.from[path])) continue;
        changes.push({ project: effort.id, path, from: patch.from[path], to: now });
        out.line(`${path}: ${clip(JSON.stringify(patch.from[path]), 40)} → ${clip(JSON.stringify(now), 40)}`);
        patch.from[path] = now;
      }
      current = applyPatch(current, patch);
    }
    if (!changes.length) {
      out.line('All patches already match upstream.');
      return { project: effort.id, changes, noop: true };
    }
    return { project: effort.id, changes, overrides };
  },
};

export const find = {
  summary: 'Add, replace or remove a sourced finding on a project.',
  usage: '<id> --text "..." --url https://... [--index n|--remove] | <id> --clear',
  value: ['text', 'url', 'index', 'source'],
  bool: ['remove', 'clear', 'clear-source', 'rebase'],
  async run({ out, flags }, [query]) {
    const state = await loadState(flags);
    const effort = resolveProject(state, query);
    const overrides = draft(state);
    const current = structuredClone(effort.findings ?? []);
    const index = flags.index ? Number(flags.index.at(-1)) : null;
    if (index !== null && (!Number.isInteger(index) || index < 0 || index >= current.length)) {
      throw invalid(`--index must be 0 to ${Math.max(0, current.length - 1)}.`);
    }

    let next = current;
    if (flags.clear) next = [];
    else if (flags.remove) {
      if (index === null) throw invalid('--remove needs --index.');
      next.splice(index, 1);
    } else {
      const text = flags.text?.at(-1)?.trim();
      const url = flags.url?.at(-1);
      if (!text) throw invalid('--text is required (or use --remove/--clear).');
      if (!url || !/^https:\/\//.test(url)) throw invalid('--url is required and must be https.');
      if (current.some((f, i) => f.text === text && i !== index)) throw invalid('A finding with that text already exists.');
      const item = { text, url };
      if (index === null) next.push(item);
      else next[index] = item;
    }

    let sourceWarning = null;
    if (flags['clear-source']) sourceWarning = 'cleared the source note';
    else if (flags.source?.at(-1)) sourceWarning = `source note: ${flags.source.at(-1)}`;

    const result = setField(state, overrides, effort.id, 'findings', JSON.stringify(next), {
      force: true,
      rebase: Boolean(flags.rebase),
    });
    if (flags['clear-source']) await setField(state, overrides, effort.id, 'findingsSource', 'null', {
      reuse: result.patch,
    });
    else if (flags.source?.at(-1)) await setField(state, overrides, effort.id, 'findingsSource', flags.source.at(-1), {
      reuse: result.patch,
    });

    if (next.length > 12) out.warn(`${next.length} findings; consider moving the older ones into the summary.`);
    out.line(`${flags.clear ? 'cleared' : flags.remove ? `removed [${index}]` : index === null ? 'added' : `replaced [${index}]`}; ${next.length} finding(s) now.`);
    if (sourceWarning) out.line(sourceWarning);
    return { project: effort.id, findings: next, changes: [result.change], overrides };
  },
};

export const pick = {
  summary: 'Place one project first by hand, or clear the placement.',
  usage: 'set <id> --reason "..." | clear | show',
  value: ['reason'],
  async run({ out, flags }, [action, query]) {
    const state = await loadState(flags);
    if (action === 'show') {
      const current = state.overrides.pick;
      out.line(current ? `${current.id}: ${current.reason}` : 'No pick.');
      return { pick: current ?? null };
    }
    if (action === 'clear') {
      if (!state.overrides.pick) {
        out.line('No pick to clear.');
        return { pick: null, noop: true };
      }
      const overrides = draft(state);
      overrides.pick = null;
      out.line('cleared the pick.');
      return { pick: null, overrides, changes: [{ path: 'pick', from: state.overrides.pick, to: null }] };
    }
    if (action !== 'set' || !query) throw invalid('Use `./pw pick set <id> --reason "..."`.');
    const effort = resolveProject(state, query);
    const reason = flags.reason?.at(-1)?.trim();
    if (!reason) throw invalid('--reason is required; say why it is placed by hand.');
    const overrides = draft(state);
    overrides.pick = { id: effort.id, at: today(), reason };
    out.line(`placed ${effort.name} first: ${reason}`);
    return { pick: overrides.pick, overrides, changes: [{ path: 'pick', from: state.overrides.pick, to: overrides.pick }] };
  },
};

const uniqueId = (state, id) =>
  !state.tracker.news.some((n) => n.id === id) && !(state.overrides.news ?? []).some((n) => n.id === id);

const parseSources = (values) =>
  values.map((raw) => {
    // The title may itself contain a pipe ("Xbox Series X|S"), so only the ends are fixed.
    const parts = raw.split('|');
    const url = parts.pop();
    const outlet = parts.shift();
    const title = parts.join('|');
    if (!outlet || !title || !url || !/^https:\/\//.test(url)) {
      throw invalid(`A source is "Outlet|Title|https://url", not "${raw}".`);
    }
    return { outlet: outlet.trim(), title: title.trim(), url: url.trim() };
  });

function assertArticle(article) {
  const issues = newsIssues(article, article.id ?? '?', new Set(), { strict: true }).filter((i) => i.level === 'error');
  if (issues.length) throw invalid(issues.map((i) => i.message).join(' '), '`./pw check` validates the whole file.');
}

const fromJson = (raw, label) => {
  try {
    return JSON.parse(raw);
  } catch {
    throw invalid(`${label} must be valid JSON.`);
  }
};

const newsField = {
  title: (raw) => {
    if (!raw.trim() || raw.length > 90) throw invalid('title is 1 to 90 characters.');
    return raw;
  },
  dek: (raw) => {
    if (!raw.trim() || raw.length > 240) throw invalid('dek is 1 to 240 characters.');
    return raw;
  },
  category: (raw) => {
    if (!NEWS_CATEGORIES.includes(raw)) throw invalid(`category is one of ${NEWS_CATEGORIES.join(', ')}.`);
    return raw;
  },
  date: (raw) => {
    if (!isDate(raw)) throw invalid('date is YYYY-MM-DD.');
    return raw;
  },
  by: (raw) => {
    if (!['claude', 'report', 'owner'].includes(raw)) throw invalid('by is claude, report or owner.');
    return raw;
  },
  body: (raw) => {
    const value = fromJson(raw, 'body');
    if (!Array.isArray(value) || value.length < 2 || value.length > 5) throw invalid('body is a JSON array of 2 to 5 paragraphs.');
    return value;
  },
  sources: (raw) => {
    const value = fromJson(raw, 'sources');
    if (!Array.isArray(value) || !value.length) throw invalid('sources is a JSON array of {outlet,title,url}.');
    return value;
  },
  image: (raw) => (raw === 'null' ? null : fromJson(raw, 'image')),
};

function assertEdit(article) {
  if (!article.sources.length) throw invalid('at least one source is required.');
  if (article.image && (!article.image.url || !article.image.credit || !article.image.link)) {
    throw invalid('an image needs url, credit and link.');
  }
}

export const news = {
  summary: 'List, show, add, edit or remove an article.',
  usage: 'list [--limit n] | show <id> | add --title ... --dek ... --body ... --source "Outlet|Title|https://..." | set <id> field=value... | rm <id>',
  value: ['title', 'dek', 'category', 'date', 'body', 'source', 'id', 'image', 'credit', 'link', 'by', 'limit'],
  async run({ out, flags }, [action, ...rest]) {
    const state = await loadState(flags);
    if (action === 'list') {
      const limit = Number(flags.limit?.at(-1) ?? 20);
      if (!Number.isFinite(limit) || limit < 1) throw invalid('--limit must be a positive number.');
      const rows = [...state.effective.news]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, limit);
      out.table(rows.map((n) => [n.date, n.id, n.category, clip(n.title, 60)]), ['date', 'id', 'category', 'title']);
      return { count: rows.length, articles: rows };
    }

    if (action === 'show') {
      const id = rest[0];
      const article = state.effective.news.find((n) => n.id === id);
      if (!article) throw notFound(`No article "${id}".`);
      out.line(`${article.title} (${article.id})`);
      out.line(`${article.category}, ${article.date}, by ${article.by}`);
      out.line(article.dek);
      out.line('');
      article.body.forEach((p, i) => out.line(`[${i}] ${p}`));
      out.line('');
      for (const s of article.sources) out.line(`source: ${s.outlet} — ${s.title} <${s.url}>`);
      out.line(`image: ${article.image ? `${article.image.url} (${article.image.credit})` : 'null'}`);
      return { article };
    }

    const overrides = draft(state);
    if (!overrides.news) overrides.news = [];
    if (!overrides.removedNews) overrides.removedNews = [];

    if (action === 'add') {
      const date = flags.date?.at(-1) ?? today();
      const title = flags.title?.at(-1)?.trim();
      const dek = flags.dek?.at(-1)?.trim();
      const category = flags.category?.at(-1);
      const body = flags.body ?? [];
      const sources = parseSources(flags.source ?? []);
      if (!title || !dek || !category) throw invalid('--title, --dek and --category are required.');
      if (body.length < 2) throw invalid('At least two --body paragraphs are required (3 to 4 in the playbook).');
      if (!sources.length) throw invalid('At least one --source is required.');
      const id = flags.id?.at(-1) ?? `${date}-${slug(title).replace(/^-|-$/g, '') || 'article'}`;
      if (!uniqueId(state, id)) throw invalid(`Article id "${id}" is already used.`);
      const by = flags.by?.at(-1) ?? 'claude';
      if (!['claude', 'report', 'owner'].includes(by)) throw invalid('by is claude, report or owner.');
      const article = {
        id,
        date,
        category,
        title,
        dek,
        body,
        sources,
        image: flags.image?.at(-1)
          ? { url: flags.image.at(-1), credit: flags.credit?.at(-1) ?? '', link: flags.link?.at(-1) ?? '' }
          : null,
        by,
      };
      assertArticle(article);
      overrides.news.unshift(article);
      overrides.removedNews = overrides.removedNews.filter((x) => x !== id);
      if (overrides.news.length > 40) out.warn('More than 40 of our own articles; check the cap.');
      out.line(`added ${id}: ${title}`);
      return { article, overrides, changes: [{ path: `news.${id}`, from: null, to: article }] };
    }

    if (action === 'set') {
      const [id, ...assignments] = rest;
      if (!id || !assignments.length) throw invalid('Use `./pw news set <id> field=value...`.');
      const fromOurs = overrides.news.find((n) => n.id === id);
      const upstream = state.tracker.news.find((n) => n.id === id);
      if (!fromOurs && !upstream) throw notFound(`No article "${id}".`);
      let article = structuredClone(fromOurs ?? upstream);
      for (const [field, raw] of pairs(assignments, (f, v) => [f, v])) {
        if (!newsField[field]) throw invalid(`Article field "${field}" is not editable.`);
        article[field] = newsField[field](raw);
      }
      assertEdit(article);
      if (fromOurs) {
        overrides.news[overrides.news.indexOf(fromOurs)] = article;
        overrides.removedNews = overrides.removedNews.filter((x) => x !== id);
      } else {
        overrides.news.unshift(article);
        overrides.removedNews = overrides.removedNews.filter((x) => x !== id);
      }
      out.line(`updated ${id}`);
      return { article, overrides, changes: [{ path: `news.${id}`, from: null, to: article }] };
    }

    if (action === 'rm') {
      const id = rest[0];
      const at = overrides.news.findIndex((n) => n.id === id);
      const upstream = state.tracker.news.some((n) => n.id === id);
      if (at === -1 && !upstream) throw notFound(`No article "${id}".`);
      if (at !== -1) overrides.news.splice(at, 1);
      if (upstream && !overrides.removedNews.includes(id)) overrides.removedNews.push(id);
      out.line(`removed ${id}`);
      return { id, overrides, changes: [{ path: `news.${id}`, from: state.effective.news.find((n) => n.id === id), to: null }] };
    }

    throw invalid(`Unknown news action "${action}".`);
  },
};

export const candidate = {
  summary: 'Review the inbox: list, show, ignore, or promote a candidate from a JSON file.',
  usage: 'list [--kind effort|tool] [--query text] | show <repo> | ignore <repo> --reason "..." | unignore <repo> | track <repo> --file effort.json',
  value: ['kind', 'query', 'reason', 'file'],
  async run({ out, flags }, [action, ...rest]) {
    const state = await loadState(flags);
    if (action === 'list' || action === 'show') {
      const q = (rest[0] ?? flags.query?.at(-1) ?? '').toLowerCase();
      const rows = state.effective.candidates.filter(
        (c) =>
          (!q || c.repo.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q)) &&
          (!flags.kind || c.kind === flags.kind.at(-1))
      );
      if (action === 'show') {
        const repo = rest[0];
        const item = state.effective.candidates.find((c) => c.repo === repo);
        if (!item) throw notFound(`No candidate "${repo}".`);
        out.line(JSON.stringify(item, null, 2));
        return { candidate: item };
      }
      out.table(rows.map((c) => [c.repo, c.kind, c.stars ?? '', clip(c.description ?? '', 60)]), ['repo', 'kind', 'stars', 'description']);
      return { count: rows.length, candidates: rows };
    }

    const overrides = draft(state);
    if (!overrides.ignored) overrides.ignored = [];
    if (!overrides.decided) overrides.decided = [];

    if (action === 'ignore') {
      const repo = rest[0];
      const reason = flags.reason?.at(-1)?.trim();
      if (!repo || !reason) throw invalid('Use `./pw candidate ignore <repo> --reason "..."`.');
      if (overrides.ignored.some((i) => i.repo === repo)) {
        out.line(`${repo} is already in our ignored list.`);
        return { repo, noop: true };
      }
      if (!state.effective.candidates.some((c) => c.repo === repo)) throw notFound(`No candidate "${repo}".`);
      overrides.ignored.unshift({ repo, reason, seenAt: today() });
      overrides.decided.push(repo);
      out.line(`ignored ${repo}: ${reason}`);
      return { repo, overrides, changes: [{ path: `ignored.${repo}`, from: null, to: reason }] };
    }

    if (action === 'unignore') {
      const repo = rest[0];
      const at = overrides.ignored.findIndex((i) => i.repo === repo);
      if (at === -1) throw notFound(`"${repo}" is not in our ignored list.`);
      overrides.ignored.splice(at, 1);
      overrides.decided = overrides.decided.filter((x) => x !== repo);
      out.line(`unignored ${repo}`);
      return { repo, overrides, changes: [{ path: `ignored.${repo}`, from: 'ignored', to: null }] };
    }

    if (action === 'track') {
      const repo = rest[0];
      const file = flags.file?.at(-1);
      if (!repo || !file) throw invalid('Use `pnpm candidate track <repo> --file effort.json`.');
      // Upstream may have ignored a repo we want to list; the entry then starts without stats.
      const item =
        state.effective.candidates.find((c) => c.repo === repo) ?? state.effective.ignored.find((i) => i.repo === repo);
      if (!item) throw notFound(`No candidate "${repo}".`);
      if (item.reason) out.warn(`${repo} was ignored: ${item.reason}`);
      let text;
      try {
        text = await readFile(path.resolve(file), 'utf8');
      } catch {
        throw notFound(`Cannot read ${file}.`);
      }
      const input = fromJson(text, file);
      const { changes: told = [], ...effort } = input.effort ?? input;
      effort.repo = repo;
      if (!effort.id || !effort.name || !effort.summary) throw invalid('The file needs id, name and summary.');
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(effort.id)) throw invalid('id is kebab-case.');
      if (state.effective.efforts.some((e) => e.id === effort.id)) throw invalid(`Id "${effort.id}" is taken.`);
      const entry = {
        effort: {
          tier: 'watchlist',
          verification: 'self-reported',
          blockers: [],
          highlights: [],
          gta: { loads: 0, boots: 0, menu: 0, world: 0, playable: 0, story: 0, render: 0, fps: 0, stability: 'unknown' },
          assessedAt: today(),
          assessedBy: 'claude',
          claims: [],
          ...effort,
          stats: { stars: item.stars ?? null, createdAt: item.createdAt ?? null, pushedAt: item.pushedAt ?? null },
        },
        changes: told,
      };
      overrides.added.push(entry);
      overrides.decided.push(repo);
      out.line(`promoted ${repo} as ${effort.id}`);
      return { repo, effort: effort.id, overrides, changes: [{ path: `added.${effort.id}`, from: null, to: effort.id }] };
    }

    throw invalid(`Unknown candidate action "${action}".`);
  },
};

const kebab = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);

const PRIVATE_DEFAULTS = () => ({
  tier: 'tracked',
  verification: 'self-reported',
  repo: null,
  related: [],
  basedOn: [],
  highlights: [],
  blockers: [],
  gta: { loads: 0, boots: 0, menu: 0, world: 0, playable: 0, story: 0, render: 0, fps: 0, stability: 'unknown' },
  stats: {},
  assessedAt: today(),
  assessedBy: 'claude',
  claims: [],
});

export const added = {
  summary: 'List, add or remove a project only we publish, including a private build with no repo.',
  usage: 'list | new <id> --file effort.json | rm <id>',
  value: ['file'],
  async run({ out, flags }, [action, ...rest]) {
    const state = await loadState(flags);
    if (action === 'list') {
      const rows = state.overrides.added.map(({ effort }) => [effort.id, effort.name, effort.repo ?? 'private', effort.tier ?? '']);
      out.table(rows, ['id', 'name', 'repo', 'tier']);
      return { count: rows.length, added: state.overrides.added.map((a) => a.effort?.id) };
    }

    const overrides = draft(state);
    if (action === 'rm') {
      const id = rest[0];
      const at = overrides.added.findIndex((a) => a.effort?.id === id);
      if (at === -1) throw notFound(`"${id}" is not one of our added projects.`);
      const [entry] = overrides.added.splice(at, 1);
      out.line(`removed ${id}`);
      return { id, overrides, changes: [{ path: `added.${id}`, from: entry.effort.id, to: null }] };
    }

    if (action !== 'new') throw invalid('Use `./pw added new <id> --file effort.json`.');
    const id = rest[0];
    const file = flags.file?.at(-1);
    if (!id || !file) throw invalid('Use `./pw added new <id> --file effort.json`.');
    if (!kebab(id)) throw invalid('id is kebab-case.');
    if (state.effective.efforts.some((e) => e.id === id)) throw invalid(`Id "${id}" is already listed.`);

    let text;
    try {
      text = await readFile(path.resolve(file), 'utf8');
    } catch {
      throw notFound(`Cannot read ${file}.`);
    }
    const input = fromJson(text, file);
    const { changes: told = [], ...fields } = input.effort ?? input;
    const effort = PRIVATE_DEFAULTS();
    for (const [field, value] of Object.entries(fields)) {
      if (!ADDED_FIELDS.has(field) || field === 'id') {
        if (!['id', 'claims', 'changes'].includes(field)) out.warn(`ignored unknown field "${field}"`);
        continue;
      }
      effort[field] = parseField(field, typeof value === 'string' ? value : JSON.stringify(value));
    }
    effort.id = id;
    if (!effort.name) throw invalid('The file needs a name.');
    if (!effort.summary) throw invalid('The file needs a summary.');
    if (!effort.repo && (!effort.basedOn.length || !effort.evidence)) {
      throw invalid('A private build (repo null) needs basedOn (the ids it builds on) and evidence (how we know).');
    }
    if (effort.repo && state.effective.efforts.some((e) => e.repo?.toLowerCase() === effort.repo.toLowerCase())) {
      throw invalid(`${effort.repo} is already listed.`);
    }

    overrides.added.push({ effort, changes: told });
    out.line(`added ${id}: ${effort.name}`);
    return { effort: id, overrides, changes: [{ path: `added.${id}`, from: null, to: id }] };
  },
};

export const articles = { NEWS_CATEGORIES, isDate, isDraft: Boolean };
