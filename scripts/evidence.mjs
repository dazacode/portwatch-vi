#!/usr/bin/env node
// Collects independent test reports from projects' issues into data/evidence.json.
//   node scripts/evidence.mjs [--dry-run]
// Env: GITHUB_TOKEN (needed), ANTHROPIC_API_KEY (optional: also reads what text rules can't).
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { checkReading, commitsIn, disqualify, GPU, isCopy, readByRule } from './lib/evidence.mjs';
import { readTracker } from './lib/tracker.mjs';

const MAX_PAGES = 3;
const MAX_READS = 25; // Claude calls per run
const at = (p) => new URL(`../data/${p}`, import.meta.url);
const read = async (p) => JSON.parse(await readFile(at(p), 'utf8'));
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is needed');

async function graphql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'viportlive' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return (await res.json()).data;
}

const ISSUES = `query($owner:String!,$name:String!,$since:DateTime,$after:String){repository(owner:$owner,name:$name){
  issues(first:100,after:$after,filterBy:{since:$since},orderBy:{field:UPDATED_AT,direction:DESC}){
    pageInfo{hasNextPage endCursor}
    nodes{number url title body createdAt updatedAt authorAssociation author{login ... on User{databaseId createdAt}}}}}}`;

async function issuesOf(repo, since) {
  const [owner, name] = repo.split('/');
  const out = [];
  let after = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await graphql(ISSUES, { owner, name, since, after });
    const issues = data?.repository?.issues;
    if (!issues) break;
    out.push(...issues.nodes);
    if (!issues.pageInfo.hasNextPage) break;
    after = issues.pageInfo.endCursor;
  }
  return out;
}

/** The first commit named in the report that is really in the repo's network. */
async function realCommit(repo, body) {
  const [owner, name] = repo.split('/');
  const shas = commitsIn(body);
  const fields = shas.map((s, i) => `c${i}:object(expression:"${s}"){... on Commit{oid}}`).join(' ');
  const data = await graphql(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${fields}}}`, { owner, name });
  for (const [i, s] of shas.entries()) if (data?.repository?.[`c${i}`]?.oid) return s.slice(0, 7);
  return null;
}

const { efforts, scout } = await readTracker();
const state = await read('evidence.json');
const done = new Set(state.read);
const items = new Map(state.items.map((e) => [e.url + (e.kind === 'challenge' ? e.at : ''), e]));
const startedAt = new Date().toISOString();

let claude = null;
if (process.env.ANTHROPIC_API_KEY) {
  const { makeReader } = await import('./lib/reader.mjs');
  claude = makeReader({ apiKey: process.env.ANTHROPIC_API_KEY });
}
console.log(`Claude reading: ${claude ? 'on' : 'off (text rules only)'}`);

const skipped = {};
const skip = (why) => { skipped[why] = (skipped[why] ?? 0) + 1; };
let reads = 0;

for (const e of efforts) {
  if (!e.repo || e.nuked || e.stats?.missing) continue;
  try {
    // With Claude on, older reports are revisited until each has been read once.
    const issues = await issuesOf(e.repo, claude || !state.lastRun ? `${scout.since}T00:00:00Z` : state.lastRun);
    for (const issue of issues) {
      const why = disqualify(issue);
      if (why) { skip(why); continue; }
      const known = items.get(issue.url);
      const key = `${issue.url}@${issue.updatedAt}`;
      let reading = readByRule(issue);
      let kind = 'rule';
      if (claude && !done.has(key) && reads < MAX_READS) {
        reads++;
        const answer = await claude(issue);
        if (answer) {
          done.add(key);
          reading = checkReading(answer, issue);
          kind = issue.authorAssociation === 'CONTRIBUTOR' ? 'contributor' : 'tester';
        }
      } else if (done.has(key)) {
        continue; // already read in full; keep that result
      }
      if (!reading) {
        skip('no clear result');
        if (known) items.delete(issue.url);
        continue;
      }
      if (isCopy(issue, issues)) { skip('copied report'); continue; }
      const commit = await realCommit(e.repo, issue.body);
      if (!commit) { skip('commit not in repo'); continue; }
      items.set(issue.url, {
        effortId: e.id, kind, ...reading, commit,
        gpu: issue.body.match(GPU)[0].replace(/\s+/g, ' '),
        url: issue.url, at: issue.createdAt,
        // Enough to count a person once, without keeping a list of names.
        by: createHash('sha256').update(`${e.id}:${issue.author.databaseId}`).digest('hex').slice(0, 12),
      });
    }
  } catch (err) {
    console.log(`  ! ${e.repo}: ${err.message}`);
  }
}

const list = [...items.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
console.log(`${list.length} reports, ${list.length - state.items.length} more than before. Read by Claude: ${reads}.`);
console.log('Left out:', JSON.stringify(skipped));
if (process.argv.includes('--show')) for (const r of list) console.log(`${r.effortId} ${r.outcome} ${r.stage} [${r.gpu} ${r.commit}] "${r.quote}" ${r.url}`);
if (!process.argv.includes('--dry-run')) {
  await writeFile(at('evidence.json'), `${JSON.stringify({ lastRun: startedAt, read: [...done].slice(-5000), items: list }, null, 2)}\n`);
}
