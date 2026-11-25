// The last commit of every project, in one GitHub GraphQL request (1 of 5,000 points an hour).

const clean = (s) => s.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);

/* Atom feeds: no key, no API quota, and a commit appears immediately instead of on the next run. */
const trackedOf = (efforts) =>
  efforts.filter((e) => /^[\w.-]+\/[\w.-]+$/.test(e.repo ?? '') && !e.nuked && !e.stats?.missing);

const xmlText = (s) =>
  String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

const tagOf = (block, tag) =>
  block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1] ?? '';

/**
 * Recent commits of every project, read from GitHub's public Atom feeds in parallel.
 * Returns [{ projectId, name, sha, message, at, url }] newest first. A branch is optional: without
 * one the feed follows the default branch. A repo that 404s is simply left out.
 */
export async function recentCommitsFast(efforts, perRepo = 10, { concurrency = 8, timeoutMs = 6000 } = {}) {
  const tracked = trackedOf(efforts);
  const out = [];
  let next = 0;
  async function worker() {
    while (next < tracked.length) {
      const e = tracked[next++];
      const path = e.branch ? `commits/${encodeURIComponent(e.branch)}.atom` : 'commits.atom';
      try {
        const res = await fetch(`https://github.com/${e.repo}/${path}`, {
          headers: { 'User-Agent': 'viportlive', Accept: 'application/atom+xml' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) continue;
        const xml = await res.text();
        for (const [, entry] of [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].slice(0, perRepo)) {
          const sha = tagOf(entry, 'id').match(/Commit\/([0-9a-f]{40})/i)?.[1];
          const url = entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i)?.[1];
          const at = xmlText(tagOf(entry, 'updated')).trim();
          if (!sha || !url || !Number.isFinite(Date.parse(at))) continue;
          // A merge commit's first line only names a branch; the next one has the pull request's title.
          const lines = xmlText(tagOf(entry, 'title')).split('\n').map(clean).filter(Boolean);
          const message = (/^Merge (pull request|branch)/.test(lines[0] ?? '') && lines[1]) || lines[0];
          out.push({ projectId: e.id, name: e.name, sha: sha.slice(0, 7), message: message || 'No message', at, url });
        }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tracked.length) }, worker));
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** The last commit of every project, from the same feeds. */
export async function lastCommitsFast(efforts, opts) {
  const out = {};
  for (const c of await recentCommitsFast(efforts, 1, opts)) {
    out[c.projectId] ??= { sha: c.sha, message: c.message, at: c.at, url: c.url };
  }
  return out;
}

/** `efforts` need id and repo. Returns { [id]: { sha, message, at, url } } for the ones that answered. */
export async function lastCommits(efforts, token) {
  const tracked = trackedOf(efforts);
  if (!tracked.length) return {};
  const fields = 'defaultBranchRef{target{... on Commit{oid message committedDate url}}}';
  const query = `{${tracked.map((e, i) => {
    const [owner, name] = e.repo.split('/');
    return `r${i}:repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){${fields}}`;
  }).join(' ')}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'viportlive' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  // A repo that vanished comes back as null with an error; the rest are still good.
  const { data } = await res.json();
  if (!data) throw new Error('GitHub returned no data');
  const out = {};
  tracked.forEach((e, i) => {
    const commit = data[`r${i}`]?.defaultBranchRef?.target;
    if (!commit?.oid) return;
    // A merge commit's first line only names a branch; the next one has the pull request's title.
    const lines = commit.message.split('\n').map(clean).filter(Boolean);
    const message = (/^Merge (pull request|branch)/.test(lines[0] ?? '') && lines[1]) || lines[0];
    out[e.id] = { sha: commit.oid.slice(0, 7), message: message || 'No message', at: commit.committedDate, url: commit.url };
  });
  return out;
}
