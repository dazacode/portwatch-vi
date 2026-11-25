// Reads test reports in projects' issues. A report counts only if an independent person names a commit
// that exists, the graphics card it ran on and how far the game got, in words that are really there.
import { STAGES } from '../../lib/verification.mjs';
import { overlap, shingles } from './core.mjs';

const MIN_ACCOUNT_DAYS = 90;
const INSIDE = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export const GPU = /\b(?:(?:RTX|GTX)\s?(?:PRO\s?)?\d{3,4}(?:\s?(?:Ti|SUPER))*|RX\s?\d{4}(?:\s?(?:XT|XTX|GRE))*|Radeon\s\w+|Arc\s[AB]\d{3})\b/i;
const SHA = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g;

// Results in the first person or as a measurement. Plans, questions and code talk don't match.
const REACHED = [
  ['playable', /\b(?:I (?:can|could|was able to)|able to)\s+(?:walk|move|drive|control|play)\b[^.\n]{0,60}|\b(?:walked|drove|moved)\s+(?:around|through)\b[^.\n]{0,50}/i],
  ['world', /\b\d+(?:\.\d+)?\s?fps\s+in\s+(?:the\s+)?(?:world|game(?:play)?)\b|\b(?:reach(?:es|ed)|gets?|got|loads?|loaded)\s+(?:in)?to\s+the\s+(?:world|prologue|gameplay)\b|\bin[- ]world\s+(?:at|runs?|renders?)\b/i],
  ['menu', /\b(?:reach(?:es|ed)|gets?|got)\s+(?:to\s+)?the\s+(?:main\s+|title\s+)?menus?\b|\bmenus?\b[^.\n]{0,60}\b(?:render|display|work)(?:s|ed)?\s+(?:correctly|fine|properly)\b/i],
  ['boots', /\b(?:reach(?:es|ed)|gets?|got)\s+(?:to\s+)?the\s+(?:intro|loading screen|splash|logos?)\b|\b(?:intro|loading art|splash)\b[^.\n]{0,50}\brender(?:s|ed)?\s+(?:correctly|fine|properly)\b/i],
];
const NEGATED = /\b(?:not|never|n['’]t|cannot|unable|until|before|while|should|would|if|when|once|expected?|want|goal|todo|need(?:s|ed)?\s+to)\b[^.\n]{0,40}$/i;
// Someone else's result, quoted or cited.
const CITED = /^\s*>|\b(?:reported|according|someone|others?|testers?|users?|#\d+)\b[^.\n]{0,50}$/i;

/** Whether the words on a line in front of a result take it back, or say it is someone else's. */
export const isNegated = (before) => NEGATED.test(before.slice(-70));
export const isCited = (before) => CITED.test(before.slice(-90));

const plain = (body) => body.replace(/```[\s\S]*?```/g, '\n').replace(/<!--[\s\S]*?-->/g, '').replace(/\r/g, '');

function find(text) {
  for (const [stage, re] of REACHED) {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const line = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index);
      if (isNegated(line) || isCited(line)) continue;
      return { stage, quote: m[0].replace(/\s+/g, ' ').trim().slice(0, 160) };
    }
  }
  return null;
}

/** Why a report can't be used, or null. Cheap, so it runs before anything is read. */
export function disqualify(issue, now = Date.now()) {
  if (!issue.author?.createdAt) return 'no account';
  if (INSIDE.has(issue.authorAssociation)) return 'project member';
  if (now - Date.parse(issue.author.createdAt) < MIN_ACCOUNT_DAYS * 864e5) return 'new account';
  if (!GPU.test(issue.body)) return 'no graphics card';
  if (!(issue.body.match(SHA) ?? []).length) return 'no commit';
  return null;
}

export const commitsIn = (body) => [...new Set(body.match(SHA) ?? [])].slice(0, 5);

/** What text rules alone can say: only plain successes. A failure needs the whole report to be read. */
export function readByRule(issue) {
  const reached = find(plain(`${issue.title}\n${issue.body}`));
  return reached && { ...reached, outcome: 'reached' };
}

const squash = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** A reading by Claude, kept only if its quote is really in the issue. */
export function checkReading(reading, issue) {
  if (!reading || !STAGES.includes(reading.stage) || !['reached', 'failed'].includes(reading.outcome)) return null;
  const quote = squash(reading.quote);
  if (quote.length < 12 || !squash(`${issue.title}\n${issue.body}`).includes(quote)) return null;
  return { stage: reading.stage, outcome: reading.outcome, quote: String(reading.quote).trim().slice(0, 160) };
}

/** True when most of this report was already posted by someone else. */
export function isCopy(issue, others) {
  const mine = shingles(issue.body);
  return others.some((o) => o.author?.login !== issue.author?.login && overlap(mine, shingles(o.body)) >= 0.6);
}
