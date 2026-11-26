// Reading and writing the data files. tracker.json is upstream's and is never written here.
import { constants } from 'node:fs';
import { access, mkdir, open, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyOverrides, isTracker } from '../../../lib/overrides.mjs';
import { CliError, internal } from './errors.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const MAX_BACKUPS = 10;
const LOCK_STALE_MS = 60_000;

export const resolveRoot = (flags = {}) =>
  path.resolve(flags.root ?? process.env.PW_ROOT ?? REPO);

export function pathsFor(root, flags = {}) {
  const dataDir = path.resolve(flags.data ?? process.env.PW_DATA_DIR ?? path.join(root, 'data'));
  const house = path.join(dataDir, '.pw');
  return {
    root,
    dataDir,
    tracker: path.join(dataDir, 'tracker.json'),
    overrides: path.join(dataDir, 'overrides.json'),
    evidence: path.join(dataDir, 'evidence.json'),
    intel: path.join(dataDir, 'intel.json'),
    packageJson: path.join(root, 'package.json'),
    house,
    lock: path.join(house, 'lock'),
    backups: path.join(house, 'backups'),
  };
}

export async function readJson(file, label, fallback) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw new CliError('missing_file', `Cannot read the ${label} file: ${file}`, {
      hint: 'Check --data and that the file exists.',
      exit: 2,
    });
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new CliError('bad_json', `${label} is not valid JSON: ${err.message}`, {
      hint: `Fix ${file} before running a writing command.`,
      exit: 2,
    });
  }
}

const emptyOverrides = () => ({ patches: [], added: [], pick: null });

export const isOverrides = (o) =>
  Boolean(o) &&
  Array.isArray(o.patches) &&
  Array.isArray(o.added) &&
  (o.news === undefined || Array.isArray(o.news)) &&
  (o.ignored === undefined || Array.isArray(o.ignored)) &&
  (o.decided === undefined || Array.isArray(o.decided)) &&
  (o.removedNews === undefined || Array.isArray(o.removedNews));

/** Everything a command reads, with our patches already applied. */
export async function loadState(flags) {
  const root = resolveRoot(flags);
  const paths = pathsFor(root, flags);
  const tracker = await readJson(paths.tracker, 'tracker');
  if (!isTracker(tracker)) {
    throw new CliError('bad_tracker', 'data/tracker.json does not have the shape the site reads.', {
      hint: 'The upstream sync may have been interrupted. Restore it before writing.',
      exit: 2,
    });
  }
  const overrides = await readJson(paths.overrides, 'overrides', emptyOverrides());
  if (!isOverrides(overrides)) {
    throw new CliError('bad_overrides', 'data/overrides.json has the wrong shape.', {
      hint: 'It needs at least "patches" and "added" arrays. See data/overrides.json in git.',
      exit: 2,
    });
  }
  const evidence = (await readJson(paths.evidence, 'evidence', { items: [] })).items ?? [];
  const { tracker: effective, lapsed } = applyOverrides(tracker, overrides);
  return { root, paths, tracker, overrides, evidence, effective, lapsed };
}

/** A fresh copy for a command to edit before deciding to save it. */
export const draft = (state) => structuredClone(state.overrides);

/** The effective tracker after a draft, without writing anything. */
export const preview = (state, overrides) => applyOverrides(state.tracker, overrides).tracker;

export async function trackerAge(file) {
  try {
    const info = await stat(file);
    return (Date.now() - info.mtimeMs) / 1000;
  } catch {
    return null;
  }
}

async function lock(paths) {
  await mkdir(paths.house, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(paths.lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      await handle.close();
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let stale = true;
      try {
        const info = await stat(paths.lock);
        stale = Date.now() - info.mtimeMs > LOCK_STALE_MS;
      } catch {
        stale = true;
      }
      if (stale && attempt === 0) {
        await unlink(paths.lock).catch(() => {});
        continue;
      }
      throw new CliError('locked', 'Another pw command is writing the data.', {
        hint: `Wait a moment, or delete ${paths.lock} if nothing else is running.`,
        exit: 4,
      });
    }
  }
}

async function backup(paths, file) {
  try {
    await mkdir(paths.backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeFile(
      path.join(paths.backups, `${path.basename(file)}.${stamp}.json`),
      await readFile(file, 'utf8')
    );
    const all = (await readdir(paths.backups))
      .filter((f) => f.startsWith(`${path.basename(file)}.`))
      .sort();
    for (const old of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) {
      await unlink(path.join(paths.backups, old)).catch(() => {});
    }
  } catch {
    // A backup is a convenience; a failed one must not stop the write.
  }
}

/** Write overrides.json whole, after a backup, atomically. Nothing else is ever written. */
export async function saveOverrides(paths, overrides) {
  if (!isOverrides(overrides)) throw internal('Refusing to write an overrides file with the wrong shape.');
  await lock(paths);
  try {
    await backup(paths, paths.overrides);
    const tmp = `${paths.overrides}.tmp-${process.pid}`;
    const text = `${JSON.stringify(overrides, null, 2)}\n`;
    JSON.parse(text);
    await writeFile(tmp, text, 'utf8');
    await rename(tmp, paths.overrides);
  } finally {
    await unlink(paths.lock).catch(() => {});
  }
}

/** Write the ledger whole, after a backup, atomically. */
export async function saveIntel(paths, intel) {
  await lock(paths)
  try {
    await backup(paths, paths.intel)
    const tmp = `${paths.intel}.tmp-${process.pid}`
    const text = `${JSON.stringify(intel, null, 2)}\n`
    JSON.parse(text)
    await writeFile(tmp, text, 'utf8')
    await rename(tmp, paths.intel)
  } finally {
    await unlink(paths.lock).catch(() => {})
  }
}

export async function isWritable(dir) {
  try {
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
