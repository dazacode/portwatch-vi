// Writing one value into the override file, with upstream conflicts in the way.
import { applyPatch, getPath, movedPaths, setPath } from '../../../lib/overrides.mjs';
import { conflict, invalid, notFound } from './errors.mjs';
import { addedEntry, patchesFor, sourceOf } from './resolve.mjs';
import { ADDED_FIELDS, PATCH_FIELDS, parseField } from './validate.mjs';

const clone = (v) => (v === undefined ? null : structuredClone(v));

/** Point every `from` at what is really there now, in patch order. */
function rebase(rawEffort, patches) {
  let current = rawEffort;
  for (const patch of patches) {
    for (const path of Object.keys(patch.from)) patch.from[path] = clone(getPath(current, path));
    current = applyPatch(current, patch);
  }
}

/**
 * Set one field on a draft. Returns the draft-level change, or `{ noop: true }`.
 * `rebase` moves a lapsed patch onto upstream's current value instead of refusing.
 */
export function setField(state, overrides, id, path, raw, { force = false, rebase: doRebase = false, reuse = null } = {}) {
  const source = sourceOf(state, id);
  if (source.kind === 'missing') throw notFound(`"${id}" is not in the tracker or the added list.`);

  const effort = state.effective.efforts.find((e) => e.id === id);
  const before = clone(getPath(effort, path));
  let after;
  if (source.kind === 'added') {
    if (!ADDED_FIELDS.has(path)) throw invalid(`${path} is not editable on an added project.`);
    after = parseField(path, raw);
    if (!force && JSON.stringify(before) === JSON.stringify(after)) return { noop: true, before, after };
    addedEntry(overrides, id).effort = setPath(addedEntry(overrides, id).effort, path, after);
    return { change: { project: id, path, from: before, to: after }, before, after, entry: 'added' };
  }

  if (!PATCH_FIELDS.has(path)) {
    throw invalid(`${path} belongs to upstream; it cannot be patched.`, 'See `./pw fields`.');
  }
  after = parseField(path, raw);
  if (!force && JSON.stringify(before) === JSON.stringify(after)) return { noop: true, before, after };

  const rawEffort = state.tracker.efforts.find((e) => e.id === id);
  const patches = patchesFor(overrides, id);
  const moved = movedPaths(rawEffort, patches);
  if (moved.length > 0) {
    if (!doRebase) {
      throw conflict(`${id}: upstream changed ${moved.join(', ')} since our patch was written.`, 'Re-run with --rebase to move the patch onto the current values.', {
        moved,
      });
    }
    rebase(rawEffort, patches);
  }

  // The last patch that already sets this path is the one to update, so values stay in one place.
  const owner = [...patches].reverse().find((p) => Object.hasOwn(p.to, path));
  if (owner) {
    owner.to[path] = after;
    return { change: { project: id, path, from: before, to: after }, before, after, patch: owner };
  }
  if (reuse && reuse.id === id) {
    if (!Object.hasOwn(reuse.to, path)) reuse.from[path] = before;
    reuse.to[path] = after;
    return { change: { project: id, path, from: before, to: after }, before, after, patch: reuse };
  }
  const patch = { id, from: { [path]: before }, to: { [path]: after } };
  overrides.patches.push(patch);
  return { change: { project: id, path, from: before, to: after }, before, after, patch };
}

/** Put a generated change line on the same record the values were written to. */
export function addChange(overrides, id, kind, text) {
  if (!text) return;
  const added = addedEntry(overrides, id);
  const target = added ? added : [...overrides.patches].reverse().find((p) => p.id === id);
  if (!target) return;
  if (!target.changes) target.changes = [];
  target.changes.push({ date: new Date().toISOString().slice(0, 10), kind, text });
}

export function removeEmptyPatches(overrides) {
  overrides.patches = overrides.patches.filter((p) => Object.keys(p.to).length > 0 && !p.dropped);
}
