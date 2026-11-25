#!/usr/bin/env node
// Records milestones by comparing the projects with the scores of the last run, in data/scores.json.
// The last commit can't be compared with: a sync commits the new scores before this runs.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { addMilestones, scores } from './lib/milestones.mjs';
import { readTracker } from './lib/tracker.mjs';

const at = (p) => new URL(`../data/${p}`, import.meta.url);
const read = async (p) => JSON.parse(await readFile(at(p), 'utf8'));

// The first run has no scores yet, so it starts from the last commit.
const committed = () => scores(JSON.parse(
  execFileSync('git', ['show', 'HEAD:data/tracker.json'], { encoding: 'utf8', maxBuffer: 64 * 2 ** 20 }),
).efforts);
const before = await read('scores.json').then((s) => new Map(Object.entries(s)), (err) => {
  if (err.code !== 'ENOENT') throw err;
  return committed();
});
const after = scores((await readTracker()).efforts);

const events = await read('milestones.json');
const next = addMilestones(events, before, after, new Date().toISOString());
console.log(`${next.length} milestones (${next.length - events.length} more than before).`);
if (!process.argv.includes('--dry-run')) {
  await writeFile(at('milestones.json'), `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(at('scores.json'), `${JSON.stringify(Object.fromEntries(after), null, 2)}\n`);
}
