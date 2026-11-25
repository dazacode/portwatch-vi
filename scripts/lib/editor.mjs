// The overnight editor: what it reads, the plan shape, and how a plan becomes `pw` calls.
// The rules are EDITOR.md's. Nothing here talks to a model or a network; editor.mjs does both.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { ADDED_FIELDS, PATCH_FIELDS } from '../cli/lib/validate.mjs';
import { parseJson } from './free-ai.mjs';

export const LEAD_LIMIT = 24;
export const FINDING_LIMIT = 12;
export const SCORE_LIMIT = 6;
export const CANDIDATE_LIMIT = 6;
export const ADDED_LIMIT = 2;
export const ARTICLE_LIMIT = 2;
const MAX_FINDINGS_PER_PROJECT = 12;
const README_CHARS = 1200;

export const normUrl = (value) =>
  String(value ?? '')
    .replace(/#.*$/, '')
    .replace(/\/$/, '')
    .toLowerCase();

const https = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const words = (value) => String(value ?? '').split(/\s+/).filter(Boolean).length;
const oneLine = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A README as flat text, long enough to judge a claim and short enough for a free model. */
export function readmeDigest(text) {
  return String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^ *[-*] *\[[ x]\] */gm, '- ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, README_CHARS);
}

const leadId = (i) => `L${i + 1}`;

/**
 * Lead candidates from what the harvester and the scout already collected. Only https links that
 * still lie inside the window, aren't already stored as a finding or an article, and don't repeat.
 */
export function collectLeads({ news, tracker, usedUrls = new Set(), since, now = Date.now() }) {
  const seen = new Set([...usedUrls].map(normUrl));
  const rows = [];
  const push = (item) => {
    const url = item.url ?? item.link;
    if (!url || !https(url)) return;
    const key = normUrl(url);
    if (seen.has(key)) return;
    const at = item.date ? Date.parse(item.date) : now;
    if (Number.isFinite(at) && at < since) return;
    seen.add(key);
    rows.push({
      title: oneLine(item.title, 220),
      outlet: oneLine(item.outlet ?? item.via ?? 'Unknown outlet', 60),
      url,
      date: item.date ? String(item.date).slice(0, 10) : new Date(now).toISOString().slice(0, 10),
      category: item.category ?? null,
    });
  };
  for (const item of news?.items ?? []) push(item);
  for (const item of tracker?.news ?? []) push(item);
  for (const item of tracker?.dmca ?? []) push(item);
  for (const item of tracker?.headlines ?? []) push(item);
  return rows
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LEAD_LIMIT)
    .map((row, i) => ({ id: leadId(i), ...row }));
}

/** Every finding or article URL already in the data, so a lead is never used twice. */
export function usedUrls(efforts, news) {
  const out = new Set();
  for (const effort of efforts) for (const finding of effort.findings ?? []) if (finding.url) out.add(finding.url);
  for (const article of news) for (const source of article.sources ?? []) if (source.url) out.add(source.url);
  return out;
}

/** A finding is worth taking only when its words meet the lead it is cited from. */
export function findingBacked(text, lead) {
  const token = (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const needles = token(text);
  if (needles.length < 3) return true;
  const source = new Set(token(`${lead.title} ${lead.outlet}`));
  const needleDigits = /\d/.test(needles.join(" "));
  const sourceDigits = /\d/.test(String(lead.title));
  return needles.some((w) => source.has(w)) || (needleDigits && sourceDigits);
}

/** Projects worth a look: their README moved, they carry an unread claim, or a lead names them. */
export function projectsToReview({ tracker, overrides, leads, since, limit = 6 }) {
  const chosen = new Map();
  const add = (id, why) => {
    if (chosen.has(id)) chosen.get(id).why.push(why);
    else chosen.set(id, { id, why: [why] });
  };
  for (const effort of tracker.efforts) {
    const touched = effort.readmeChangedAt ? Date.parse(effort.readmeChangedAt) : 0;
    if (touched >= since) add(effort.id, 'README changed');
    if ((effort.claims ?? []).length) add(effort.id, 'unassessed claim');
  }
  for (const effort of overrides.added) {
    const id = effort.effort?.id;
    if (!id) continue;
    const touched = effort.effort.readmeChangedAt ? Date.parse(effort.effort.readmeChangedAt) : 0;
    if (touched >= since) add(id, 'README changed');
  }
  if (chosen.size < limit) {
    const haystack = leads.map((l) => l.title.toLowerCase()).join(' ');
    for (const effort of tracker.efforts) {
      if (chosen.size >= limit) break;
      const name = effort.name.toLowerCase();
      const repo = String(effort.repo ?? '').toLowerCase();
      if ((name.length > 3 && haystack.includes(name)) || (repo && haystack.includes(repo))) {
        add(effort.id, 'named in a lead');
      }
    }
  }
  return [...chosen.values()].slice(0, limit);
}

/** New candidates, minus what we already decided. */
export function candidatesToReview({ tracker, overrides, limit = CANDIDATE_LIMIT }) {
  const decided = new Set(overrides.decided ?? []);
  const ignored = new Set((overrides.ignored ?? []).map((i) => i.repo));
  return (tracker.candidates ?? [])
    .filter((c) => c.status === 'new' && !decided.has(c.repo) && !decided.has(c.id) && !ignored.has(c.repo))
    .slice(0, limit);
}

/** Articles the editor already published today. Upstream's desk has its own budget. */
export function articlesToday({ overrides, today }) {
  return (overrides.news ?? []).filter((n) => n.date === today).length;
}

const scoreFields = new Set([...PATCH_FIELDS, ...ADDED_FIELDS]);
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const CATEGORIES = ['Leak', 'Takedown', 'Legal', 'Security', 'Official', 'Port', 'Safety'];

const findingItem = z.object({
  project: z.string(),
  text: z.string().min(8).max(300),
  lead: z.string(),
  source: z.string().max(160).optional(),
});
const scoreItem = z.object({
  project: z.string(),
  fields: z.record(z.string(), scalar),
  reason: z.string().max(240).optional(),
  withdrawn: z.boolean().optional(),
});
const effortItem = z.object({
  id: z.string().optional(),
  name: z.string().max(80),
  summary: z.string().max(700),
  tier: z.enum(['tracked', 'watchlist']).default('watchlist'),
  highlights: z.array(z.string()).max(3).default([]),
  blockers: z.array(z.string()).max(3).default([]),
  gta: z.record(z.string(), scalar).default({}),
  basedOn: z.array(z.string()).default([]),
  target: z.string().max(80).optional(),
  byline: z.string().max(120).optional(),
});
const candidateItem = z.object({
  repo: z.string(),
  action: z.enum(['ignore', 'track']),
  reason: z.string().max(200),
  effort: effortItem.optional(),
});
const addedItem = z.object({
  id: z.string(),
  name: z.string().max(80),
  repo: z.string().nullable().optional(),
  basedOn: z.array(z.string()).default([]),
  evidence: z.string().max(200),
  summary: z.string().max(700),
  highlights: z.array(z.string()).max(3).default([]),
  blockers: z.array(z.string()).max(3).default([]),
  gta: z.record(z.string(), scalar).default({}),
  target: z.string().max(80).optional(),
  byline: z.string().max(120).optional(),
  publicLater: z.boolean().optional(),
});
const articleItem = z.object({
  title: z.string().max(90),
  dek: z.string().max(240),
  category: z.enum(CATEGORIES),
  body: z.array(z.string()).min(2).max(5),
  sourceLeads: z.array(z.string()).min(1).max(4),
  date: z.string().optional(),
});
const pickItem = z.object({ project: z.string(), reason: z.string().max(200) });

/** The plan Claude returns: one object with a list per kind. */
export const planSchema = z.object({
  note: z.string().max(800).optional(),
  findings: z.array(findingItem).max(FINDING_LIMIT).default([]),
  scores: z.array(scoreItem).max(SCORE_LIMIT).default([]),
  candidates: z.array(candidateItem).max(CANDIDATE_LIMIT).default([]),
  added: z.array(addedItem).max(ADDED_LIMIT).default([]),
  articles: z.array(articleItem).max(ARTICLE_LIMIT).default([]),
  pick: pickItem.nullable().default(null),
});

/**
 * The free route returns one flat `actions` list instead. A reply cut off mid-list still yields the
 * whole actions before the cut, because free-ai closes the array.
 */
const actionSchema = z.discriminatedUnion('kind', [
  findingItem.extend({ kind: z.literal('finding') }),
  scoreItem.extend({ kind: z.literal('score') }),
  candidateItem.extend({ kind: z.literal('candidate') }),
  addedItem.extend({ kind: z.literal('added') }),
  articleItem.extend({ kind: z.literal('article') }),
  pickItem.extend({ kind: z.literal('pick') }),
]);
export const actionsSchema = z.object({
  note: z.string().max(800).optional(),
  actions: z.array(actionSchema).default([]),
});

/** Group a flat action list into the plan shape the applier uses. */
export function planFromActions({ note, actions = [] } = {}) {
  const plan = { note, findings: [], scores: [], candidates: [], added: [], articles: [], pick: null };
  for (const action of actions) {
    if (action.kind === 'finding') plan.findings.push(action);
    else if (action.kind === 'score') plan.scores.push(action);
    else if (action.kind === 'candidate') plan.candidates.push(action);
    else if (action.kind === 'added') plan.added.push(action);
    else if (action.kind === 'article') plan.articles.push(action);
    else if (action.kind === 'pick') plan.pick = action;
  }
  return plan;
}

/** The JSON object in a model reply, checked against the plan schema. */
export function parsePlan(text) {
  const json = typeof text === 'string' ? parseJson(text) : text;
  const parsed = planSchema.safeParse(json);
  return parsed.success ? { ok: true, plan: parsed.data } : { ok: false, why: parsed.error?.issues?.slice(0, 3) };
}

const toArg = (value) => {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  return JSON.stringify(value);
};

/** Resolve a plan's project names to ids, same order as `pw` would try: id, repo, name, then one substring. */
export function resolveEffort(efforts, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return null;
  const exact =
    efforts.find((e) => String(e.id).toLowerCase() === q) ??
    efforts.find((e) => String(e.repo ?? '').toLowerCase() === q) ??
    efforts.find((e) => String(e.name ?? '').toLowerCase() === q);
  if (exact) return exact;
  const hits = efforts.filter(
    (e) => String(e.id).toLowerCase().includes(q) || String(e.name ?? '').toLowerCase().includes(q)
  );
  return hits.length === 1 ? hits[0] : null;
}

/** A project for a plan line; a lead id is looked up in that lead's title for exactly one name. */
export function projectFor(query, efforts, leadOf) {
  const direct = resolveEffort(efforts, query);
  if (direct) return direct;
  const lead = leadOf.get(String(query ?? '').trim());
  if (!lead) return null;
  const title = lead.title.toLowerCase();
  const hits = efforts.filter((e) => String(e.name ?? '').length > 3 && title.includes(e.name.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Apply a plan through `pw`. Every write is dry-run first and only then repeated. A refused dry run,
 * an unbacked URL or a score that falls without a withdrawal reason is skipped, never guessed at.
 * `pw(args)` must resolve to the CLI's JSON envelope.
 */
export async function applyPlan(plan, { pw, efforts, leads, findingsByProject = new Map(), existingPick = null, today, dry = false, log = () => {} }) {
  const applied = [];
  const skipped = [];
  const leadOf = new Map(leads.map((l) => [l.id, l]));
  const tmp = await mkdtemp(path.join(tmpdir(), 'pw-plan-'));

  const perform = async (label, args) => {
    const check = await pw([...args, '--dry-run']);
    if (!check.ok) return { ok: false, why: `${check.error?.code ?? 'error'}: ${check.error?.message ?? 'dry run failed'}` };
    if (dry) {
      applied.push(label);
      return { ok: true, data: check.data ?? {} };
    }
    const real = await pw(args);
    if (!real.ok) return { ok: false, why: `${real.error?.code ?? 'error'}: ${real.error?.message ?? 'write failed'}` };
    applied.push(label);
    return { ok: true, data: real.data ?? {} };
  };

  const skip = (label, why) => {
    skipped.push(`${label}: ${why}`);
    log(`  - ${label}: ${why}`);
  };

  // Added projects first, so a later score can name one.
  for (const item of plan.added ?? []) {
    const label = `added ${item.id}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) {
      skip(label, 'id is not kebab-case');
      continue;
    }
    if (efforts.some((e) => e.id === item.id)) {
      skip(label, 'id already exists');
      continue;
    }
    const file = path.join(tmp, `${item.id}.json`);
    await writeFile(file, JSON.stringify(item, null, 2));
    const result = await perform(label, ['added', 'new', item.id, '--file', file]);
    if (result.ok) efforts.push({ id: item.id, name: item.name, repo: item.repo ?? null });
    else skip(label, result.why);
  }

  for (const item of plan.scores ?? []) {
    const project = projectFor(item.project, efforts, leadOf);
    const label = `score ${item.project}`;
    if (!project) {
      skip(label, 'no such project (use an id from the brief)');
      continue;
    }
    const pairs = Object.entries(item.fields).filter(([field]) => scoreFields.has(field));
    if (!pairs.length) {
      skip(label, 'no editable field');
      continue;
    }
    const args = ['set', project.id, ...pairs.map(([field, value]) => `${field}=${toArg(value)}`)];
    const preview = await pw([...args, '--dry-run']);
    if (!preview.ok) {
      skip(label, `${preview.error?.code ?? 'error'}: ${preview.error?.message ?? 'dry run failed'}`);
      continue;
    }
    const delta = Number(preview.data?.delta ?? 0);
    if (preview.data?.noop) {
      skip(label, 'values already match');
      continue;
    }
    if (delta < 0 && !item.withdrawn) {
      skip(label, `falls ${Math.abs(delta).toFixed(1)} without withdrawn=true (EDITOR.md rule 6)`);
      continue;
    }
    const change = oneLine(item.reason, 200);
    if (change) args.push('--change', change);
    if (delta < 0) args.push('--kind', 'down');
    applied.push(`${label} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`);
    if (dry) continue;
    const real = await pw(args);
    if (!real.ok) {
      skip(label, `${real.error?.code ?? 'error'}: ${real.error?.message ?? 'write failed'}`);
      applied.pop();
    }
  }

  const findings = [...(plan.findings ?? [])];
  for (const line of findings) {
    const project = projectFor(line.project, efforts, leadOf);
    const lead = leadOf.get(line.lead);
    const label = `finding ${line.project}`;
    if (!project) {
      skip(label, 'no such project (use an id from the brief)');
      continue;
    }
    if (!lead) {
      skip(label, `lead ${line.lead} is not in the brief`);
      continue;
    }
    if (!findingBacked(line.text, lead)) {
      skip(label, 'text has nothing in common with the lead');
      continue;
    }
    const already = findingsByProject.get(project.id) ?? [];
    if (already.some((f) => normUrl(f.url) === normUrl(lead.url) && f.text === line.text)) {
      skip(label, 'duplicate');
      continue;
    }
    if (already.length >= MAX_FINDINGS_PER_PROJECT) {
      skip(label, 'project already has 12 findings');
      continue;
    }
    const note = oneLine(line.source ?? `${lead.outlet}, ${lead.date}`, 160);
    const result = await perform(label, ['find', project.id, '--text', line.text, '--url', lead.url, '--source', note]);
    if (!result.ok) skip(label, result.why);
    else already.push({ text: line.text, url: lead.url });
  }

  for (const item of plan.candidates ?? []) {
    const label = `candidate ${item.repo}`;
    if (item.action === 'ignore') {
      const result = await perform(label, ['candidate', 'ignore', item.repo, '--reason', oneLine(item.reason, 200)]);
      if (!result.ok) skip(label, result.why);
      continue;
    }
    const file = path.join(tmp, `${item.repo.replace('/', '-')}.json`);
    if (!item.effort) {
      skip(label, 'a track needs an effort object');
      continue;
    }
    const fallback = item.repo.split('/').at(-1).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { gta, ...rest } = item.effort;
    const fileEffort = { ...rest, id: item.effort.id ?? fallback };
    if (gta && Object.keys(gta).length) fileEffort.gta = gta;
    await writeFile(file, JSON.stringify(fileEffort, null, 2));
    const result = await perform(label, ['candidate', 'track', item.repo, '--file', file]);
    if (!result.ok) skip(label, `${result.why} (a track needs a fuller effort file)`);
  }

  for (const item of plan.articles ?? []) {
    const label = `article "${oneLine(item.title, 50)}"`;
    const sources = item.sourceLeads.map((id) => leadOf.get(id)).filter(Boolean);
    if (!sources.length) {
      skip(label, 'no lead among the sources');
      continue;
    }
    if (item.body.length < 2 || item.body.length > 5) {
      skip(label, 'body needs 2 to 5 paragraphs');
      continue;
    }
    const bodyWords = item.body.reduce((sum, p) => sum + words(p), 0);
    if (bodyWords < 120 || bodyWords > 220) {
      skip(label, `body is ${bodyWords} words, needs 120 to 220`);
      continue;
    }
    const args = ['news', 'add', '--title', item.title, '--dek', item.dek, '--category', item.category];
    args.push('--date', item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : today);
    for (const paragraph of item.body) args.push('--body', paragraph);
    for (const source of sources) args.push('--source', `${source.outlet}|${source.title}|${source.url}`);
    args.push('--by', 'claude');
    const result = await perform(label, args);
    if (!result.ok) skip(label, result.why);
  }

  if (plan.pick) {
    const project = projectFor(plan.pick.project, efforts, leadOf);
    const label = `pick ${plan.pick.project}`;
    if (!project) skip(label, 'no such project');
    else if (project.nuked) skip(label, 'nuked projects are already put last');
    else if (existingPick && existingPick.id !== project.id) {
      skip(label, `"${existingPick.id}" is already placed; the owner's placement stands`);
    } else if (existingPick) skip(label, 'already the pick');
    else {
      const result = await perform(label, ['pick', 'set', project.id, '--reason', oneLine(plan.pick.reason, 200)]);
      if (!result.ok) skip(label, result.why);
    }
  }

  await rm(tmp, { recursive: true, force: true }).catch(() => {});
  return { applied, skipped };
}

/** `pw` as a JSON-only process, for the runner. */
export function makePw({ root, data, env = process.env, cli = new URL('../pw.mjs', import.meta.url) }) {
  const args = [cli.pathname];
  if (data) args.push('--data', data);
  if (root) args.push('--root', root);
  return (argv) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [...args, ...argv, '--json'],
        { cwd: root, env, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout) => {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ ok: false, error: { code: 'internal', message: String(err?.message ?? stdout).slice(0, 300) } });
          }
        }
      );
    });
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export const SYSTEM = `You are the overnight editor for VIPortLive, a fan tracker of community efforts to run the leaked Xbox Series build of GTA VI on PC. Work only from the brief. Reply with ONE JSON object, no prose and no code fence.

Hard rules:
1. Cite only URLs that appear under LEADS, by their id. A fact with no lead is skipped, not guessed. Forum and social chatter is a lead, not proof.
2. A value changes only when the project's own repo or a reputable outlet plainly says it happened. Keep verification self-reported.
3. Never lower a score on judgement alone. Only when the project withdrew a claim: set "withdrawn": true and give "reason".
4. Findings are observations, one short sentence (under 20 words), for something a lead really shows. No duplicates of the stored findings.
5. Articles: only meaningful, verified news not already covered. 3 or 4 paragraphs, 120-220 words in total, own words, no leak download advice, and no image.
6. It is normal to return empty lists. Do not pad.
7. A candidate is ignored unless its README shows a real GTA VI effort; then track it and include an effort object with name, summary, a tier, highlights and blockers from the README, and the first gta values the README plainly reports. A tool is only tracked as a tool when flagged so.
8. Decide every candidate in the brief. Use a lead on a reviewed project for a finding whenever it plainly says something about that project. Only leave both empty when there is truly nothing.
9. The pick is a placement, never a score. Set it only when none is placed; the owner's placement stands. Nuked projects are already put last.

JSON shape:
{"note":"one line on what you did",
 "findings":[{"project":"<id from PROJECTS TO REVIEW>","text":"...","lead":"L1","source":"outlet, date"}],
 "scores":[{"project":"<id>","fields":{"gta.fps":4,"gta.render":0.75},"reason":"change line","withdrawn":false}],
 "candidates":[{"repo":"owner/name","action":"ignore"|"track","reason":"...","effort":{"name":"...","summary":"...","tier":"watchlist","highlights":[],"blockers":[],"gta":{}}}],
 "added":[{"id":"kebab-id","name":"...","basedOn":["<project id>"],"evidence":"how we know","summary":"...","highlights":[],"blockers":[],"gta":{},"target":"GTA VI only"}],
 "articles":[{"title":"...","dek":"...","category":"Port","body":["...","...","..."],"sourceLeads":["L2"]}],
 "pick":{"project":"<id>","reason":"..."}|null}

Scores use the written steps: loads/boots/menu/world/playable are 0, 0.5 or 1; story 0, 0.1, 0.25, 0.4, 0.6, 0.85 or 1; render 0, 0.25, 0.5, 0.75 or 1; fps a number; stability unknown, constant, often, sometimes, rarely, stable. A "project" is always the project's id from PROJECTS TO REVIEW (or one you add), never a lead id. Never write the game's own files into a project it doesn't name.
Private builds (repo null) are only added when a lead shows them and basedOn plus evidence are known.`;
