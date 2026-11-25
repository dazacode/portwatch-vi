// Score arithmetic for one project, including hypothetical values. Nothing here writes.
import { isPrivateBuild, scoreEffort } from '../../../lib/scoring.mjs';
import { rate } from '../../../lib/rating.mjs';
import { verify } from '../../../lib/verification.mjs';

export const evidenceFor = (state, id) => state.evidence.filter((e) => e.effortId === id);

export function scoreView(state, effort) {
  const score = scoreEffort(effort);
  const checked = verify(evidenceFor(state, effort.id), score.score);
  const ours = rate(effort, checked.stages);
  return {
    claimed: score.score,
    stage: score.reachedLabel,
    reached: score.reached,
    rating: ours.score,
    parts: ours.parts,
    verified: checked.score,
    private: isPrivateBuild(effort),
    nuked: Boolean(effort.nuked),
  };
}

/**
 * 1-based place by our rating, counting projects ahead. Public code only, like the race, and a second
 * number that counts private builds as well.
 */
export function rankOf(state, id, efforts = state.effective.efforts) {
  const own = efforts.find((e) => e.id === id);
  if (!own) return { public: null, all: null };
  const rated = (rows) =>
    rows
      .filter((e) => !e.nuked)
      .map((e) => ({ id: e.id, rating: scoreView(state, e).rating }))
      .sort((a, b) => b.rating - a.rating);
  const ahead = (rows) => rows.filter((r) => r.rating > scoreView(state, own).rating).length + 1;
  return {
    public: ahead(rated(efforts.filter((e) => !isPrivateBuild(e)))),
    all: ahead(rated(efforts)),
  };
}

export function projectRow(state, effort) {
  const view = scoreView(state, effort);
  return {
    id: effort.id,
    name: effort.name,
    repo: effort.repo ?? null,
    tier: effort.tier,
    stage: view.stage,
    claimed: view.claimed,
    rating: view.rating,
    verified: view.verified,
    isPrivate: view.private,
    nuked: view.nuked,
    missing: Boolean(effort.stats?.missing),
    stars: effort.stats?.stars ?? null,
    rank: view.nuked || view.private ? null : rankOf(state, effort.id).public,
    picked: state.effective.pick?.id === effort.id,
    patched: state.overrides.patches.some((p) => p.id === effort.id),
    added: state.overrides.added.some((a) => a.effort?.id === effort.id),
    stageLabel: view.stage,
  };
}
