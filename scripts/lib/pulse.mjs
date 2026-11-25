// The last commit of every project, in one GitHub GraphQL request (1 of 5,000 points an hour).

const clean = (s) => s.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);

/** `efforts` need id and repo. Returns { [id]: { sha, message, at, url } } for the ones that answered. */
export async function lastCommits(efforts, token) {
  const tracked = efforts.filter((e) => /^[\w.-]+\/[\w.-]+$/.test(e.repo ?? '') && !e.nuked && !e.stats?.missing);
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
