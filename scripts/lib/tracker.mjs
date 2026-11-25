// The tracker as the site shows it: upstream's file with our findings on top.
import { readFile } from 'node:fs/promises';
import { applyOverrides } from '../../lib/overrides.mjs';

const read = async (p) => JSON.parse(await readFile(new URL(`../../data/${p}`, import.meta.url), 'utf8'));

export const readTracker = async () =>
  applyOverrides(await read('tracker.json'), await read('overrides.json')).tracker;
