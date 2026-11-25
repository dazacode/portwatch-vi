// Strict, quiet argument parsing. Unknown flags are errors so a typo never writes the wrong field.
import { usage } from './errors.mjs';

const GLOBAL_BOOL = ['json', 'help', 'quiet', 'dry-run', 'force', 'no-color', 'no-assessed'];
const GLOBAL_VALUE = ['data', 'root'];

const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
};

const nearest = (name, known) => {
  const hit = known
    .map((k) => [k, distance(name, k)])
    .sort((a, b) => a[1] - b[1])[0];
  return hit && hit[1] <= 3 ? `--${hit[0]}` : null;
};

/**
 * Flags become `flags[name]`. Booleans are true; value flags keep a list, global ones a string. Positionals are kept in
 * order. `--no-something` is false. Everything after `--` is positional.
 */
export function parseArgv(argv, spec = {}) {
  const valueFlags = new Set([...GLOBAL_VALUE, ...(spec.value ?? [])]);
  const boolFlags = new Set([...GLOBAL_BOOL, ...(spec.bool ?? [])]);
  const flags = {};
  const positional = [];
  let stopped = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (stopped || !arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    if (arg === '--') {
      stopped = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }
    const eq = arg.indexOf('=');
    let name = arg.slice(2, eq === -1 ? undefined : eq);
    let inline = eq === -1 ? null : arg.slice(eq + 1);

    if (name.startsWith('no-') && boolFlags.has(name.slice(3)) && !boolFlags.has(name)) {
      flags[name.slice(3)] = false;
      continue;
    }
    if (boolFlags.has(name)) {
      if (inline !== null) throw usage(`--${name} takes no value.`);
      flags[name] = true;
      continue;
    }
    if (!valueFlags.has(name)) {
      const near = nearest(name, [...valueFlags, ...boolFlags]);
      throw usage(`Unknown flag --${name}.`, near ? `Did you mean ${near}?` : null);
    }
    if (inline === null) {
      inline = argv[++i];
      if (inline == null) throw usage(`--${name} needs a value.`);
    }
    // Global values are plain strings, as they are before the command.
    if (GLOBAL_VALUE.includes(name)) {
      flags[name] = inline;
      continue;
    }
    if (flags[name] === undefined) flags[name] = [];
    flags[name].push(inline);
  }

  return { flags, positional };
}

/** The last value of a repeatable flag, or a default. */
export const one = (flags, name, fallback = undefined) =>
  flags[name] == null ? fallback : flags[name].at(-1);

/** Every value of a repeatable flag, or an empty list. */
export const many = (flags, name) => flags[name] ?? [];

export const bool = (flags, name) => flags[name] === true;
