#!/usr/bin/env node
// Refreshes the projects only we list. Upstream's scout doesn't know them, so without this their stars
// would stay as they were, and a takedown would go unnoticed.
import { readFile, writeFile } from 'node:fs/promises';
import { makeGitHub } from './lib/core.mjs';

const file = new URL('../data/overrides.json', import.meta.url);
const overrides = JSON.parse(await readFile(file, 'utf8'));
const gh = makeGitHub({ token: process.env.GITHUB_TOKEN });
const since = new Date(Date.now() - 7 * 864e5).toISOString();

for (const { effort } of overrides.added) {
  if (!effort.repo) continue;
  try {
    const meta = await gh.repo(effort.repo);
    if (meta.missing) {
      effort.stats = { ...effort.stats, missing: true, missingStatus: meta.status };
      console.log(`${effort.name}: GitHub answered ${meta.status}`);
      continue;
    }
    if (meta.fullName.toLowerCase() !== effort.repo.toLowerCase()) console.log(`::warning::${effort.repo} is now ${meta.fullName}`);
    const { stars, forks, openIssues, createdAt, pushedAt, archived } = meta;
    const { missingStatus: _, ...kept } = effort.stats;
    const commits7d = await gh.commitsSince(effort.repo, effort.branch || meta.defaultBranch, since);
    effort.stats = { ...kept, stars, forks, openIssues, createdAt, pushedAt, archived, missing: false, commits7d };
    console.log(`${effort.name}: ${stars} stars, pushed ${pushedAt}`);
  } catch (err) {
    // Not an answer about the repo, so nothing changes.
    console.log(`  ! ${effort.repo}: ${err.message}`);
  }
}
if (!process.argv.includes('--dry-run')) await writeFile(file, `${JSON.stringify(overrides, null, 2)}\n`);
