// Field parsing and the rules the editor playbook sets. Values arrive as strings from the shell.
import { STABILITY, TRACKS } from '../../../lib/scoring.mjs';
import { invalid } from './errors.mjs';

const LADDER = ['loads', 'boots', 'menu', 'world', 'playable'];
const string = (max, { nullable = false } = {}) => (raw, path) => {
  if (raw === 'null' && nullable) return null;
  if (raw === 'null') throw invalid(`${path} cannot be null.`);
  if (!raw.trim()) throw invalid(`${path} cannot be empty.`);
  if (raw.length > max) throw invalid(`${path} is longer than ${max} characters.`);
  return raw;
};

const list = (maxItems, maxWords, special) => (raw, path) => {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    // A plain sentence is a one-item list.
    value = [raw];
  }
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw invalid(`${path} must be a JSON array of strings.`, 'Example: \'["one line","another"]\'');
  }
  if (value.length > maxItems) throw invalid(`${path} takes at most ${maxItems} items.`);
  for (const item of value) {
    if (!item.trim()) throw invalid(`${path} has an empty item.`);
    if (item.split(/\s+/).length > maxWords) {
      throw invalid(`${path} items stay under ${maxWords} words: "${item.slice(0, 40)}…"`);
    }
    if (special && !special.test(item)) throw invalid(`${path}: "${item.slice(0, 40)}…" should name GTA VI.`);
  }
  return value;
};

const number = (min, max) => (raw, path) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw invalid(`${path} must be a number, not "${raw}".`);
  if (value < min || value > max) throw invalid(`${path} is ${value}; it must be ${min} to ${max}.`);
  return value;
};

const boolean = (raw, path) => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw invalid(`${path} is true or false.`);
};

const step = (key) => (raw, path) => {
  const value = Number(raw);
  const steps = TRACKS.find((t) => t.key === key).steps.map((s) => s.v);
  if (!steps.includes(value)) {
    throw invalid(`${path} must be one of the written steps: ${steps.join(', ')}.`);
  }
  return value;
};

const stability = (raw, path) => {
  if (raw in STABILITY) return raw;
  return number(0, 1)(raw, path);
};

const object = (raw, path) => {
  try {
    return JSON.parse(raw);
  } catch {
    throw invalid(`${path} must be JSON.`);
  }
};

const findingList = (raw, path) => {
  const value = object(raw, path);
  if (!Array.isArray(value)) throw invalid(`${path} must be an array.`);
  return value.map((f, i) => {
    if (typeof f?.text !== 'string' || !f.text.trim()) throw invalid(`${path}[${i}].text is required.`);
    if (f.url != null && !/^https:\/\//.test(f.url)) throw invalid(`${path}[${i}].url must be https.`);
    return { text: f.text.trim(), ...(f.url ? { url: f.url } : {}) };
  });
};

const FIELDS = {
  summary: string(700),
  highlights: list(3, 20),
  blockers: list(3, 20),
  tier: (raw) => {
    if (!['tracked', 'watchlist'].includes(raw)) throw invalid('tier is "tracked" or "watchlist".');
    return raw;
  },
  verification: (raw) => {
    if (!['self-reported', 'reproduced'].includes(raw)) {
      throw invalid('verification is "self-reported" or "reproduced".');
    }
    return raw;
  },
  assessedAt: (raw) => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00Z`));
    if (!ok) throw invalid('assessedAt is a real YYYY-MM-DD date.');
    return raw;
  },
  assessedBy: string(40),
  manualScore: (raw, path) => (raw === 'null' ? null : number(0, 100)(raw, path)),
  provenOn: string(200, { nullable: true }),
  findings: findingList,
  findingsSource: string(500, { nullable: true }),
  publicLater: boolean,
  name: string(80),
  repo: (raw) => {
    if (raw === 'null') return null;
    if (!/^[\w.-]+\/[\w.-]+$/.test(raw)) throw invalid('repo looks like "owner/name", or null for a private build.');
    return raw;
  },
  branch: string(80),
  basedOn: list(10, 10),
  related: list(10, 10),
  evidence: string(200),
  avatar: string(200),
  byline: string(120),
  approach: string(80),
  target: string(80),
  nuked: (raw, path) => (raw === 'null' ? null : object(raw, path)),
  gta: (raw, path) => {
    const value = object(raw, path);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw invalid('gta must be an object.');
    return value;
  },
  stats: (raw, path) => {
    const value = object(raw, path);
    if (!value || Array.isArray(value)) throw invalid('stats must be an object.');
    return value;
  },
  ...Object.fromEntries(LADDER.map((key) => [`gta.${key}`, number(0, 1)])),
  'gta.story': step('story'),
  'gta.render': step('render'),
  'gta.fps': number(0, 240),
  'gta.stability': stability,
};

/** Upstream owns `id`, `name`, `repo`, `branch`, `stats` and the private-build fields; the rest patch. */
export const PATCH_FIELDS = new Set(
  Object.keys(FIELDS).filter((f) => !['id', 'name', 'repo', 'branch', 'evidence', 'avatar', 'byline', 'approach', 'target', 'nuked', 'publicLater', 'stats'].includes(f))
);

export const ADDED_FIELDS = new Set(Object.keys(FIELDS));

export function parseField(path, raw) {
  const parser = FIELDS[path];
  if (!parser) throw invalid(`Unknown field "${path}".`, 'Run `./pw fields` for the list.');
  return parser(String(raw), path);
}

export const ladderWarning = (path, value) =>
  path.startsWith('gta.') && LADDER.includes(path.slice(4)) && ![0, 0.5, 1].includes(value)
    ? `${path} is ${value}; the ladder usually uses 0, 0.5 or 1.`
    : null;
