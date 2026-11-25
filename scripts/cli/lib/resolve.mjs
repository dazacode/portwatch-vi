import { ambiguous, notFound } from './errors.mjs';

const fold = (s) => String(s ?? '').toLowerCase();

/** Exact id, then repo, then name, then one unique substring. Never guesses between two. */
export function resolveProject(state, query) {
  const q = String(query ?? '').trim();
  if (!q) throw notFound('No project given.', 'Run `./pw list` to see ids.');
  const efforts = state.effective.efforts;
  const exact = efforts.filter((e) => e.id === q);
  if (exact.length === 1) return exact[0];

  const tests = [
    (e) => fold(e.id) === fold(q),
    (e) => e.repo && fold(e.repo) === fold(q),
    (e) => fold(e.name) === fold(q),
  ];
  for (const test of tests) {
    const hits = efforts.filter(test);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) throw ambiguous(q, hits.slice(0, 8).map(pick));
  }
  const hits = efforts.filter(
    (e) => fold(e.id).includes(fold(q)) || fold(e.name).includes(fold(q)) || fold(e.repo).includes(fold(q))
  );
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw ambiguous(q, hits.slice(0, 8).map(pick));
  throw notFound(`No project matches "${q}".`, 'Run `./pw list --query <text>` to search.');
}

export const pick = (e) => ({ id: e.id, name: e.name, repo: e.repo ?? null, tier: e.tier });

/** Where a project's values come from: upstream (a patch) or the added list (direct). */
export const sourceOf = (state, id) => {
  if (state.overrides.added.some((a) => a.effort?.id === id)) return { kind: 'added' };
  if (state.tracker.efforts.some((e) => e.id === id)) return { kind: 'patch' };
  return { kind: 'missing' };
};

export const addedEntry = (overrides, id) => overrides.added.find((a) => a.effort?.id === id);
export const patchesFor = (overrides, id) => overrides.patches.filter((p) => p.id === id);
