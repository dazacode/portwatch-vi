#!/usr/bin/env node
// Keeps data/channels.json in step with the READMEs of tracked projects.
//   node scripts/channels.mjs [--dry-run]
import { readFile, writeFile } from 'node:fs/promises';
import { key, mergeChannels } from './lib/channels.mjs';
import { makeGitHub } from './lib/core.mjs';
import { readTracker } from './lib/tracker.mjs';

const at = (p) => new URL(`../data/${p}`, import.meta.url);
const read = async (p) => JSON.parse(await readFile(at(p), 'utf8'));

const { efforts } = await readTracker();
const current = await read('channels.json');
const gh = makeGitHub({ token: process.env.GITHUB_TOKEN });

const readmes = new Map();
for (const e of efforts) {
  if (!e.repo || e.nuked) continue;
  try {
    const text = await gh.readme(e.repo, e.branch);
    if (text) readmes.set(e.id, text);
  } catch (err) {
    console.log(`  ! ${e.repo}: ${err.message}`);
  }
}

const next = mergeChannels(current, efforts, readmes);
const before = new Set(current.map(key));
const after = new Set(next.map(key));
for (const k of after) if (!before.has(k)) console.log(`+ ${k}`);
for (const k of before) if (!after.has(k)) console.log(`- ${k}`);
console.log(`${readmes.size} READMEs read, ${next.length} channels.`);

if (!process.argv.includes('--dry-run')) {
  await writeFile(at('channels.json'), `${JSON.stringify(next, null, 2)}\n`);
}
