#!/usr/bin/env node
// Finds, sorts and summarises what the site already publishes, with an AI model that needs no key.
// Reads data/news.json, activity.json, tracker.json and milestones.json. Writes data/digest.json and
// nothing else. With no model reachable it sorts by rules and keeps the lines it already has.
//
//   node scripts/digest.mjs            # full run
//   node scripts/digest.mjs --dry-run  # ask the model and print the result, write nothing
//   node scripts/digest.mjs --rules    # no network at all
//
// Env, all optional: FREE_AI_BASE_URL and FREE_AI_MODEL (another OpenAI-compatible endpoint),
// FREE_AI=off, DIGEST_MAX_REQUESTS (6).
import { appendFile, readFile, rename, writeFile } from 'node:fs/promises';
import { isHostile } from '../lib/digest-safety.mjs';
import { buildDigest } from './lib/digest.mjs';
import { createFreeAi, providersFrom } from './lib/free-ai.mjs';
import { readTracker } from './lib/tracker.mjs';

const at = (name) => new URL(`../data/${name}`, import.meta.url);
const read = async (name) => JSON.parse(await readFile(at(name), 'utf8'));
const dryRun = process.argv.includes('--dry-run');
const rules = process.argv.includes('--rules');

const [news, activity, tracker, milestones, previous] = await Promise.all([
  read('news.json'),
  read('activity.json'),
  readTracker(),
  read('milestones.json'),
  read('digest.json').catch(() => null),
]);

const cap = Number(process.env.DIGEST_MAX_REQUESTS);
const ai = createFreeAi({
  providers: rules ? [] : providersFrom(process.env),
  maxRequests: Number.isInteger(cap) && cap > 0 ? Math.min(cap, 60) : 6,
  budgetMs: cap > 6 ? 1_800_000 : 270_000,
  log: console.log,
});

const { digest, changed, report } = await buildDigest({
  news, activity, tracker, milestones, previous, ask: rules ? null : ai.ask,
});

const unread = news.items.filter((s) => !digest.stories[s.id]?.by);
const skipped = unread.filter((s) => isHostile(s.title)).length;
const left = unread.length - skipped;
console.log(`${ai.stats.requests} requests, ${report.written} answers used, ${report.cached} kept from before, ${report.rejected.length} lines rejected, ${left} stories not read yet, ${skipped} never sent.`);
for (const f of report.failed) console.log(`  ! ${f}`);
for (const r of report.rejected) console.log(`  - ${r.what}, ${r.why}: ${r.text}`);
console.log(`Summary by ${digest.now.by ?? "rules"}:`);
for (const p of digest.now.points) console.log(`  * ${p.text ?? "(headline)"}  [${p.sources.join(", ")}]`);

for (const b of digest.breakdowns?.items ?? []) {
  console.log(`Breakdown (${b.topic}): ${b.headline}`);
  for (const s of b.sentences) console.log(`  * ${s.text}  [${s.sources.join(', ')}]`);
}
for (const p of Object.values(digest.projects)) console.log(`Project: ${p.summary}`);
for (const [id, n] of Object.entries(digest.notes)) if (n.text) console.log(`Note ${id}: ${n.text}`);

if (!dryRun && changed) {
  // Renamed into place, so a run that is stopped halfway can't leave half a file.
  const part = at('digest.json.part');
  await writeFile(part, `${JSON.stringify(digest, null, 1)}\n`);
  await rename(part, at('digest.json'));
  console.log('Wrote data/digest.json');
} else if (!changed) {
  console.log('No change; nothing written.');
}

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## Digest\n${ai.stats.requests} requests, ${report.written} answers used, ${report.rejected.length} rejected, summary by ${digest.now.by ?? "rules"}.\n`,
  );
}
