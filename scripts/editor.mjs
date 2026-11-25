#!/usr/bin/env node
// The overnight editor. Reads the harvest, the tracker and our overrides, asks a model for a plan,
// and applies it through `./pw` only: dry run first, `./pw check` before anything is kept.
//
//   node scripts/editor.mjs [--dry-run]
//
// Env: ANTHROPIC_API_KEY (best judgement) or the keyless FREE_AI / FREE_AI_BASE_URL / FREE_AI_MODEL.
//      GITHUB_TOKEN (READMEs and commits). FREE_AI=off turns the keyless route off.
// The rules are EDITOR.md's; the guardrails are in scripts/lib/editor.mjs.
import { execFile } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState } from './cli/lib/data.mjs';
import { createFreeAi, providersFrom } from './lib/free-ai.mjs';
import { makeGitHub } from './lib/core.mjs';
import {
  applyPlan,
  articlesToday,
  candidatesToReview,
  collectLeads,
  makePw,
  parsePlan,
  planFromActions,
  actionsSchema,
  projectsToReview,
  readJson,
  readmeDigest,
  usedUrls,
  SYSTEM,
  ARTICLE_LIMIT,
} from './lib/editor.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const dryRun = process.argv.includes('--dry-run');
const flag = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : process.argv[at + 1];
};
const root = flag('root') ?? ROOT;
const data = flag('data') ?? path.join(root, 'data');
const pw = makePw({ root, data });
const log = (line = '') => console.log(line);

const FREE_SHAPE = `The keyless model gets a flat list instead. Reply with {"actions":[...],"note":"one line"}: actions first, note last. Each action has "kind" and the fields of that kind:
{"kind":"finding","project":"<id>","text":"...","lead":"L1","source":"outlet, date"}
{"kind":"score","project":"<id>","fields":{"gta.fps":4},"reason":"...","withdrawn":false}
{"kind":"candidate","repo":"owner/name","action":"ignore"|"track","reason":"...","effort":{"name":"...","summary":"...","tier":"watchlist","highlights":[],"blockers":[],"gta":{}}}
{"kind":"added","id":"...","name":"...","basedOn":[],"evidence":"...","summary":"...","blockers":[],"gta":{}}
{"kind":"article","title":"...","dek":"...","category":"Port","body":["..."],"sourceLeads":["L2"]}
{"kind":"pick","project":"<id>","reason":"..."}
Return {"actions":[]} when there is nothing. Keep every string short: the reply may be cut off.`;

/** Run `git config user.email`; EDITOR.md rule 1 stops the run on a wrong identity. */
const gitEmail = () =>
  new Promise((resolve) => {
    execFile('git', ['-C', root, 'config', 'user.email'], (err, stdout) => resolve(err ? '' : stdout.trim()));
  });

function oneLine(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const model = async () =>
  (await import('@anthropic-ai/sdk')).default;

/** Claude, one forced JSON answer, one retry if it came back malformed. */
async function askClaude({ system, user, apiKey }) {
  const Anthropic = await model();
  const client = new Anthropic({ apiKey });
  const messages = [{ role: 'user', content: user }];
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await client.messages.create({
        model: process.env.EDITOR_MODEL?.trim() || 'claude-opus-5-5',
        max_tokens: 9000,
        temperature: 0.2,
        system,
        messages,
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return { ok: false, why: 'Claude rate limited' };
      if (err instanceof Anthropic.APIError) return { ok: false, why: `Claude API ${err.status}: ${err.message}` };
      return { ok: false, why: err.message };
    }
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const parsed = parsePlan(text);
    if (parsed.ok) return { ok: true, plan: parsed.plan, by: 'Claude, ' + res.model };
    log(`  ! reply was not the JSON asked for (try ${attempt + 1})`);
    messages.push({ role: 'assistant', content: text.slice(0, 4000) });
    messages.push({ role: 'user', content: 'Reply with only the JSON object from the shape, nothing else.' });
  }
  return { ok: false, why: 'Claude did not return a usable plan' };
}

/** The keyless route: same brief, one flat action list it can be cut off inside. */
async function askFree({ system, user, schema }) {
  const providers = providersFrom(process.env);
  if (!providers.length) return { ok: false, why: 'no model (set ANTHROPIC_API_KEY or leave FREE_AI on)' };
  const ai = createFreeAi({ providers, maxRequests: 5, budgetMs: 240_000, timeoutMs: 90_000, log });
  const reply = await ai.ask({ system, user, schema, maxTokens: 1500 });
  if (!reply.ok) return { ok: false, why: reply.reason ?? 'no answer' };
  const plan = planFromActions(reply.value);
  const count = plan.findings.length + plan.scores.length + plan.candidates.length + plan.added.length + plan.articles.length + (plan.pick ? 1 : 0);
  if (count) return { ok: true, plan, by: reply.by };
  // A free model sometimes describes the work in the note and forgets the list. One more go.
  const again = await ai.ask({
    system,
    user: `${user}\n\nYou returned no actions. Return them now, as {"actions":[...]}, or {"actions":[]} if truly nothing.`,
    schema,
    maxTokens: 1500,
  });
  return again.ok ? { ok: true, plan: planFromActions(again.value), by: again.by } : { ok: true, plan, by: reply.by };
}

async function main() {
  const state = await loadState({ root, data });
  const tracker = state.tracker;
  const overrides = state.overrides;
  const editorState = await readJson(path.join(data, 'editor.json'), { lastRun: null, runs: [] });
  const now = Date.now();
  const since = Math.max(editorState.lastRun ? Date.parse(editorState.lastRun) : 0, now - 24 * 36e5);
  const today = new Date().toISOString().slice(0, 10);

  if (process.env.CI) {
    const email = await gitEmail();
    if (!email.endsWith('+4lwayz@users.noreply.github.com')) {
      log(`! git user.email is "${email}", not the editor identity (EDITOR.md rule 1)`);
    }
  }

  const used = usedUrls(state.effective.efforts, state.effective.news);
  const leads = collectLeads({ news: await readJson(path.join(data, 'news.json'), {}), tracker, usedUrls: used, since, now });
  const review = projectsToReview({ tracker, overrides, leads, since });
  const candidates = candidatesToReview({ tracker, overrides });
  const remainingArticles = Math.max(0, ARTICLE_LIMIT - articlesToday({ overrides, today }));

  log(`${leads.length} lead(s), ${review.length} project(s), ${candidates.length} candidate(s), ${remainingArticles} article(s) left today`);
  if (!leads.length && !candidates.length && !review.length) {
    if (!dryRun) await saveState({ editorState, applied: [], skipped: [], by: null, note: 'quiet' });
    log('Nothing new to look at.');
    await summary({ applied: [], skipped: [], note: 'Nothing new to look at.' });
    return;
  }

  const gh = makeGitHub({ token: process.env.GITHUB_TOKEN });
  const candidateBlocks = [];
  for (const c of candidates) {
    const readme = c.repo ? readmeDigest(await gh.readme(c.repo, c.defaultBranch).catch(() => '')) : '';
    candidateBlocks.push(
      `- ${c.repo} | ${c.name} | ${c.stars ?? '?'} stars | ${oneLine(c.description, 160)} | ${(c.signals ?? []).join(', ')}${readme ? `\n  ${oneLine(readme, process.env.ANTHROPIC_API_KEY ? 1000 : 600)}` : ''}`
    );
  }
  const blocks = [];
  for (const row of review) {
    const effort = state.effective.efforts.find((e) => e.id === row.id);
    if (!effort) continue;
    let readme = '';
    let commits = [];
    if (effort.repo) {
      readme = readmeDigest(await gh.readme(effort.repo, effort.branch).catch(() => ''));
      commits = (await gh.recentCommits(effort.repo, effort.branch, 5).catch(() => [])).map((c) => c.message);
    }
    blocks.push({
      id: effort.id,
      name: effort.name,
      repo: effort.repo ?? 'private build',
      why: row.why.join(', '),
      tier: effort.tier,
      gta: effort.gta,
      summary: oneLine(effort.summary, 300),
      verification: effort.verification,
      findings: (effort.findings ?? []).map((f) => oneLine(f.text, 160)),
      readme: readme.slice(0, process.env.ANTHROPIC_API_KEY ? 1200 : 700),
      commits: commits.map((m) => oneLine(m, 120)),
    });
  }

  const findingsByProject = new Map(
    state.effective.efforts.map((e) => [e.id, structuredClone(e.findings ?? [])])
  );

  // Leads that name something we are already looking at come first, then hard news.
  const needles = [
    ...review.map((r) => r.id.toLowerCase()),
    ...candidates.map((c) => c.repo.toLowerCase()),
    ...review.map((r) => oneLine(state.effective.efforts.find((e) => e.id === r.id)?.name ?? '', 60).toLowerCase()),
  ].filter((n) => n.length > 3);
  const weight = (lead) => {
    const hay = lead.title.toLowerCase();
    if (needles.some((n) => hay.includes(n))) return 2;
    if (['Takedown', 'Legal', 'Security', 'Official'].includes(lead.category ?? '')) return 1;
    return 0;
  };
  const ranked = [...leads].sort((a, b) => weight(b) - weight(a));
  const shown = ranked.slice(0, process.env.ANTHROPIC_API_KEY ? 18 : 12);

  const user = [
    `Today is ${today} (UTC). Last editor run: ${editorState.lastRun ?? 'never'}.`,
    `Articles already written by this editor today: ${ARTICLE_LIMIT - remainingArticles} of ${ARTICLE_LIMIT}. ${remainingArticles ? 'Write one for a major event (a takedown wave, a confirmed leak, a legal step) when a lead supports it; 3 or 4 paragraphs, 120-220 words.' : ''}`,
    `PICK: ${overrides.pick ? `"${overrides.pick.id}" is already placed first; leave it unless the plan clearly replaces it` : 'none is placed; you may place one'}.`,
    '',
    'CANDIDATES (decide ignore, or track only when a full effort is justified):',
    candidates.length ? candidateBlocks.join('\n') : '- none',
    '',
    'PROJECTS TO REVIEW (stored values, findings and the repo text):',
    blocks.length ? JSON.stringify(blocks, null, 1).slice(0, 9000) : '[]',
    '',
    'LEADS (cite by id; only these URLs are allowed):',
    shown.length ? shown.map((l) => `[${l.id}] (${l.outlet}, ${l.date}${l.category ? `, ${l.category}` : ''}) ${l.title} — ${l.url}`).join('\n') : '- none',
    '',
    'Return the JSON object now.',
  ].join('\n');

  const system = SYSTEM;
  const reply = process.env.ANTHROPIC_API_KEY
    ? await askClaude({ system, user, apiKey: process.env.ANTHROPIC_API_KEY })
    : await askFree({ system: `${system}\n\n${FREE_SHAPE}`, user, schema: actionsSchema });

  if (!reply.ok) {
    log(`! no plan: ${reply.why}`);
    if (!dryRun) await saveState({ editorState, applied: [], skipped: [], by: null, note: `No plan: ${reply.why}` });
    await summary({ applied: [], skipped: [], note: `No plan: ${reply.why}` });
    return;
  }

  const plan = { ...reply.plan, articles: (reply.plan.articles ?? []).slice(0, remainingArticles) };
  if (plan.note) log(`plan: ${oneLine(plan.note, 200)}`);
  if (dryRun) log(JSON.stringify(plan, null, 1));
  const { applied, skipped } = await applyPlan(plan, {
    pw,
    efforts: state.effective.efforts,
    leads: shown,
    findingsByProject,
    existingPick: overrides.pick,
    today,
    dry: dryRun,
    log,
  });

  if (!applied.length) {
    log('Nothing applied.');
    if (!dryRun) await saveState({ editorState, applied, skipped, by: reply.by, note: plan.note ?? null });
    await summary({ applied, skipped, note: plan.note, by: reply.by });
    return;
  }

  if (!dryRun) {
    const check = await pw(['check']);
    if (!check.ok) {
      const issues = check.error?.data?.issues ?? [];
      const ours = issues.filter((i) => i.level === 'error' && !['lapsed', 'orphan_patch'].includes(i.code));
      if (ours.length) {
        log(`! check failed: ${ours.map((i) => `${i.where}: ${i.message}`).join('; ')}`);
        await revert();
        await summary({ applied: [], skipped: [...skipped, `${ours.length} check error(s), reverted`], note: plan.note, by: reply.by });
        process.exitCode = 1;
        return;
      }
      log(`check: ${issues.filter((i) => i.level === 'error').length} upstream lapse(s) only, keeping the work`);
    }
    await saveState({ editorState, applied, skipped, by: reply.by, note: plan.note ?? null });
  }

  log(`applied ${applied.length}, skipped ${skipped.length}`);
  await summary({ applied, skipped, note: plan.note, by: reply.by });
}

async function revert() {
  await new Promise((resolve) => execFile('git', ['-C', root, 'checkout', '--', 'data/overrides.json'], resolve));
}

async function saveState({ editorState, applied, skipped, by, note }) {
  const runs = [
    { at: new Date().toISOString(), by: by ?? null, applied, skipped, note: note ?? null },
    ...(editorState.runs ?? []),
  ].slice(0, 40);
  await writeFile(path.join(data, 'editor.json'), `${JSON.stringify({ lastRun: new Date().toISOString(), runs }, null, 2)}\n`);
}

async function summary({ applied, skipped, note, by }) {
  const lines = [
    '## Editor run',
    '',
    note ? oneLine(note, 300) : '_No note._',
    by ? `\nModel: ${by}` : '',
    '',
    applied.length ? applied.map((a) => `- ${a}`).join('\n') : '_Nothing applied._',
    skipped.length ? `\n<details><summary>${skipped.length} skipped</summary>\n\n${skipped.map((s) => `- ${s}`).join('\n')}\n</details>` : '',
    '',
  ];
  log('');
  log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY && !dryRun) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n')).catch(() => {});
  }
}

main().catch(async (err) => {
  console.error(err);
  await summary({ applied: [], skipped: [err.message], note: 'The editor stopped on an error.' });
  process.exitCode = 1;
});
