#!/usr/bin/env node
// Records milestones by comparing data/tracker.json with the last committed version.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { addMilestones, scores } from './lib/milestones.mjs';

const at = (p) => new URL(`../data/${p}`, import.meta.url);
const read = async (p) => JSON.parse(await readFile(at(p), 'utf8'));
const committed = JSON.parse(
  execFileSync('git', ['show', 'HEAD:data/tracker.json'], { encoding: 'utf8', maxBuffer: 64 * 2 ** 20 }),
);

const events = await read('milestones.json');
const next = addMilestones(
  events, scores(committed.efforts), scores((await read('tracker.json')).efforts), new Date().toISOString(),
);
console.log(`${next.length} milestones (${next.length - events.length} more than before).`);
if (!process.argv.includes('--dry-run')) await writeFile(at('milestones.json'), `${JSON.stringify(next, null, 2)}\n`);
