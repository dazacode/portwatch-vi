#!/usr/bin/env node
// Collects independent test reports from projects' issues into data/evidence.json.
//   node scripts/evidence.mjs [--dry-run]
// Env: GITHUB_TOKEN (needed). What text rules can't read goes to Claude with ANTHROPIC_API_KEY, or else to
// a free model that needs no key, for less weight. FREE_AI=off turns that one off.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { checkReading, commitsIn, disqualify, GPU, isCopy, readByRule } from './lib/evidence.mjs';
import { createFreeAi, PROVIDERS } from './lib/free-ai.mjs';
import { makeFreeReader } from './lib/free-reader.mjs';
import { readTracker } from './lib/tracker.mjs';

const MAX_PAGES = 3;
const MAX_READS = 25; // Claude calls per run
const FREE_READS = 10; // free model calls per run, one every 47 seconds
const FREE_MS = 9 * 6e4;
const MISSES = 3; // unanswered in a row before the rest waits for the next run
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
const freeDone = new Set(state.freeRead ?? []);
const items = new Map(state.items.map((e) => [e.url + (e.kind === 'challenge' ? e.at : ''), e]));
const startedAt = new Date().toISOString();

let claude = null;
if (process.env.ANTHROPIC_API_KEY) {
  const { makeReader } = await import('./lib/reader.mjs');
  claude = makeReader({ apiKey: process.env.ANTHROPIC_API_KEY });
}
// Pollinations only: the digest's other provider may keep what it is sent.
const free = claude || process.env.FREE_AI === 'off'
  ? null
  : createFreeAi({ providers: PROVIDERS.filter((p) => p.name === 'Pollinations'), maxRequests: FREE_READS, budgetMs: FREE_MS, log: console.log });
const freeRead = free && makeFreeReader({ ask: free.ask, log: console.log });
const repos = efforts.flatMap((e) => [e.repo, ...(e.related ?? [])]).filter(Boolean);
const ownerOf = (repo) => repo.split('/')[0].toLowerCase();
console.log(`Reading in full: ${claude ? 'Claude' : free ? 'free model' : 'off (text rules only)'}`);

const skipped = {};
const skip = (why) => { skipped[why] = (skipped[why] ?? 0) + 1; };
let reads = 0;
const waiting = []; // per project, what only the free model could read

async function add(e, issue, kind, reading) {
  const commit = await realCommit(e.repo, issue.body);
  if (!commit) { skip('commit not in repo'); return; }
  items.set(issue.url, {
    effortId: e.id, kind, ...reading, commit,
    gpu: issue.body.match(GPU)[0].replace(/\s+/g, ' '),
    url: issue.url, at: issue.createdAt,
    // Enough to count a person once, without keeping a list of names.
    by: createHash('sha256').update(`${e.id}:${issue.author.databaseId}`).digest('hex').slice(0, 12),
  });
}

for (const e of efforts) {
  if (!e.repo || e.nuked || e.stats?.missing) continue;
  try {
    // With a model on, older reports are revisited until each has been read once.
    const issues = await issuesOf(e.repo, claude || free || !state.lastRun ? `${scout.since}T00:00:00Z` : state.lastRun);
    const queue = [];
    waiting.push(queue);
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
      if (!reading && free) {
        // Already read and unchanged: that result stands.
        if (!freeDone.has(key) && !isCopy(issue, issues)) queue.push({ e, issue, key });
        continue;
      }
      if (!reading) {
        skip('no clear result');
        if (known) items.delete(issue.url);
        continue;
      }
      if (isCopy(issue, issues)) { skip('copied report'); continue; }
      await add(e, issue, kind, reading);
    }
  } catch (err) {
    console.log(`  ! ${e.repo}: ${err.message}`);
  }
}

// One from each project in turn, newest first, so no project's backlog holds up the others.
for (const queue of waiting) queue.sort((a, b) => Date.parse(b.issue.createdAt) - Date.parse(a.issue.createdAt));
let out = !free;
let missed = 0;
for (let i = 0; !out && waiting.some((q) => i < q.length); i++) {
  for (const queue of waiting) {
    if (out || i >= queue.length) continue;
    const { e, issue, key } = queue[i];
    try {
      // Nothing is sent for a report that couldn't count anyway.
      const answer = (await realCommit(e.repo, issue.body))
        ? await freeRead(issue, { name: e.name, repo: e.repo, others: repos.filter((r) => ownerOf(r) !== ownerOf(e.repo)) })
        : { reading: null, why: 'commit not in repo' };
      // One report without an answer is tried again next run, and doesn't hold up the others.
      if (!answer) { out = ++missed >= MISSES || free.stats.requests >= FREE_READS; continue; }
      missed = 0;
      freeDone.add(key);
      if (answer.reading) await add(e, issue, 'free', answer.reading);
      else { skip(answer.why); items.delete(issue.url); }
    } catch (err) {
      console.log(`  ! ${issue.url}: ${err.message}`);
    }
  }
}

const list = [...items.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
console.log(`${list.length} reports, ${list.length - state.items.length} more than before. Read by Claude: ${reads}, by the free model: ${free?.stats.requests ?? 0}.`);
console.log('Left out:', JSON.stringify(skipped));
if (process.argv.includes('--show')) for (const r of list) console.log(`${r.effortId} ${r.outcome} ${r.stage} [${r.gpu} ${r.commit}] "${r.quote}" ${r.url}`);
if (!process.argv.includes('--dry-run')) {
  await writeFile(at('evidence.json'), `${JSON.stringify({ lastRun: startedAt, read: [...done].slice(-5000), freeRead: [...freeDone].slice(-5000), items: list }, null, 2)}\n`);
}
