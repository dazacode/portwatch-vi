#!/usr/bin/env node
// Writes the last commit of every project to the file named in the first argument.
import { writeFile } from 'node:fs/promises';
import { lastCommits } from './lib/pulse.mjs';
import { readTracker } from './lib/tracker.mjs';

const { efforts } = await readTracker();
const commits = await lastCommits(efforts, process.env.GITHUB_TOKEN);
await writeFile(process.argv[2], `${JSON.stringify({ at: new Date().toISOString(), commits }, null, 2)}\n`);
console.log(`${Object.keys(commits).length} projects.`);
