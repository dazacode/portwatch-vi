// Turns changes in tracker.json into a list of milestones: who moved, how far, and whether it was a first.
import { MILESTONES, scoreEffort } from '../../lib/scoring.mjs';

const ORDER = MILESTONES.map((m) => m.key);
const MIN_POINTS = 1;
const CORRECTION_MS = 6 * 36e5; // a nudge or a step back this soon corrects the last milestone
const SAME_MS = 30 * 6e4; // reaching another stage this soon is still the same news
const MAX_EVENTS = 200;
const round = (n) => Math.round(n * 10) / 10;

export function scores(efforts) {
  return new Map(efforts.map((e) => {
    const s = scoreEffort(e);
    return [e.id, { name: e.name, score: s.score, stage: s.reached, gone: Boolean(e.nuked) }];
  }));
}

/** Adds what happened between two score maps to the events, and returns the new list, oldest first. */
export function addMilestones(events, before, after, at) {
  const next = [...events];
  for (const [id, now] of after) {
    if (now.gone) continue;
    const was = before.get(id);
    const lastIndex = next.findLastIndex((e) => e.id === id);
    const last = next[lastIndex];
    const from = was ?? { score: 0, stage: 'groundwork' };
    if (was && was.score === now.score && was.stage === now.stage) continue;

    const others = [...before].filter(([otherId]) => otherId !== id).map(([, o]) => o);
    const rank = ORDER.indexOf(now.stage);
    const firsts = {
      first: rank > 0 && rank > ORDER.indexOf(from.stage) && !others.some((o) => ORDER.indexOf(o.stage) >= rank),
      lead: now.score > Math.max(0, ...others.filter((o) => !o.gone).map((o) => o.score)),
    };

    const age = last ? Date.parse(at) - Date.parse(last.at) : Infinity;
    const newStage = last && rank > ORDER.indexOf(last.stageTo);
    if (age < (newStage ? SAME_MS : CORRECTION_MS)) {
      const merged = {
        ...last, name: now.name, to: now.score, stageTo: now.stage,
        first: newStage ? firsts.first : last.first && now.stage === last.stageTo, lead: firsts.lead || (last.lead && now.score >= last.to),
      };
      const stillCounts = round(merged.to - merged.from) >= MIN_POINTS || merged.stageTo !== merged.stageFrom;
      if (stillCounts && merged.to > merged.from) next[lastIndex] = now.score > last.to ? { ...merged, at } : merged;
      else next.splice(lastIndex, 1);
      continue;
    }
    // A project that arrives with nothing running yet isn't a milestone.
    if (!was && rank < 1) continue;
    const up = round(now.score - from.score);
    if (up >= MIN_POINTS || rank > ORDER.indexOf(from.stage)) {
      next.push({
        at, id, name: now.name, from: from.score, to: now.score,
        stageFrom: from.stage, stageTo: now.stage, debut: !was, ...firsts,
      });
    }
  }
  return next.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-MAX_EVENTS);
}
