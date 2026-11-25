#!/usr/bin/env node
// Takes upstream's tracker as it is, and says what needs a person.
//   node scripts/upstream.mjs <their tracker.json> <their scoring.js>
// Refuses a file the site can't read. Reports overrides that lapsed, and a changed scoring model:
// their code is never taken over unread.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { applyOverrides, isTracker } from '../lib/overrides.mjs';

const [trackerFile, scoringFile] = process.argv.slice(2);
const at = (p) => new URL(`../${p}`, import.meta.url);

const text = await readFile(trackerFile, 'utf8');
const tracker = JSON.parse(text);
if (!isTracker(tracker)) throw new Error('Not a tracker the site can read. Nothing was changed.');
await writeFile(at('data/tracker.json'), text);

const { lapsed } = applyOverrides(tracker, JSON.parse(await readFile(at('data/overrides.json'), 'utf8')));
for (const l of lapsed) console.log(`::warning title=Override lapsed::${l.id}: ${l.why}`);

const drift = (await readFile(scoringFile, 'utf8')) !== (await readFile(at('lib/scoring.mjs'), 'utf8'));
if (drift) console.log('::error title=Scoring changed::assets/js/scoring.js differs from lib/scoring.mjs. Read it, then copy it over.');

const { GITHUB_OUTPUT, GITHUB_STEP_SUMMARY } = process.env;
if (GITHUB_OUTPUT) await appendFile(GITHUB_OUTPUT, `drift=${drift}\n`);
if (GITHUB_STEP_SUMMARY) {
  await appendFile(GITHUB_STEP_SUMMARY, [
    `Tracker of ${tracker.updated}, ${tracker.efforts.length} projects.`,
    ...lapsed.map((l) => `- Override lapsed, ${l.id}: ${l.why}`),
    ...(drift ? ['- The scoring model changed upstream.'] : []),
    '',
  ].join('\n'));
}
console.log(`${tracker.efforts.length} projects, ${lapsed.length} overrides lapsed, scoring ${drift ? 'CHANGED' : 'the same'}.`);
