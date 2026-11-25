#!/usr/bin/env node
// Writes the last commit of every project to the file named in the first argument.
import { readFile, writeFile } from 'node:fs/promises';
import { lastCommits } from './lib/pulse.mjs';

const { efforts } = JSON.parse(await readFile(new URL('../data/tracker.json', import.meta.url), 'utf8'));
const commits = await lastCommits(efforts, process.env.GITHUB_TOKEN);
await writeFile(process.argv[2], `${JSON.stringify({ at: new Date().toISOString(), commits }, null, 2)}\n`);
console.log(`${Object.keys(commits).length} projects.`);
