#!/usr/bin/env node
// Records an approved live challenge. Runs in .github/workflows/challenge.yml; the issue is read from
// the event file, so its text never reaches a shell.
import { readFile, writeFile } from 'node:fs/promises';
import { findChallenge } from '../lib/challenge.mjs';
import { parseForm } from './lib/challenge-form.mjs';

const file = new URL('../data/evidence.json', import.meta.url);
const reply = process.argv[2];
const secret = process.env.CHALLENGE_SECRET;
if (!secret) throw new Error('CHALLENGE_SECRET is not set');

const { issue } = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const { efforts } = JSON.parse(await readFile(new URL('../data/tracker.json', import.meta.url), 'utf8'));
const form = parseForm(issue.body);
const effort = efforts.find((e) => e.id === form.project);
const found = effort && findChallenge(secret, effort.id, form.code, Date.parse(issue.created_at));

if (!found) {
  await writeFile(reply, 'Not recorded: this code was not issued to this project in the week before the issue was opened.\n');
} else {
  const state = JSON.parse(await readFile(file, 'utf8'));
  state.items = state.items.filter((e) => e.url !== issue.html_url);
  state.items.unshift({
    effortId: effort.id, kind: 'challenge', outcome: 'reached', stage: found.stage, quote: '',
    commit: /^[0-9a-f]{7,40}$/.test(form.build) ? form.build.slice(0, 7) : null,
    gpu: form.gpu.slice(0, 40) || null,
    url: issue.html_url, at: found.startsAt,
    // Once a day, so two different days verify a stage and repeating it the same day adds nothing.
    by: `challenge:${effort.id}:${found.startsAt.slice(0, 10)}`,
  });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
  await writeFile(reply, `Recorded: ${effort.name} passed a live challenge for the ${found.stage === 'menu' ? 'main menu' : 'playable'} stage. The site shows it within a few minutes.\n`);
}
