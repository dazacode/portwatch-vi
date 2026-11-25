#!/usr/bin/env node
// Every 30 minutes: scrape public news and discussion about GTA VI on PC, and harvest the public
// commit and pull-request traffic of every project on the board. Writes data/news.json and
// data/activity.json. The site reads both from the repo at runtime, so there is no deploy.
//
//   node scripts/harvest.mjs            # full run
//   node scripts/harvest.mjs --dry-run  # print what would change, write nothing
//
// Env: GITHUB_TOKEN (recommended; Actions supplies one), REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET,
//      X_BEARER_TOKEN (optional).
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const dryRun = process.argv.includes('--dry-run');
const log = console.log;

const readJson = async (name, fallback) => {
  try {
    return JSON.parse(await readFile(new URL(name, root), 'utf8'));
  } catch {
    return fallback;
  }
};

const tracker = await readJson('tracker.json', { efforts: [] });
const newsFile = await readJson('news.json', { updated: null, items: [] });
const activityFile = await readJson('activity.json', { updated: null, projects: {}, feed: [], discovered: [] });

const {
  BLUESKY_QUERIES,
  HN_QUERIES,
  REDDIT,
  fetchNews,
  fetchProjectActivity,
  fetchPullSearch,
  fetchRepos,
  mergeFeed,
  mergeNews,
  mergeProject,
  mergeRepos,
  toNewsItem,
} = await import('./lib/harvest.mjs');
const core = await import('./lib/core.mjs');

const now = Date.now();
const nowIso = new Date(now).toISOString();
const summary = { news: 0, newNews: 0, commits: 0, pulls: 0, openPrs: 0, repos: 0, errors: [] };
const note = (err) => {
  summary.errors.push(String(err?.message ?? err));
};

const token = process.env.GITHUB_TOKEN;
const efforts = tracker.efforts.filter((e) => e.repo && !e.nuked && !e.stats?.missing);
const idByRepo = new Map(efforts.map((e) => [e.repo.toLowerCase(), e.id]));
const knownRepos = new Set([...idByRepo.keys()]);

/* ---------- News and discussion ---------- */

log('Reading news feeds…');
const news = await fetchNews(now, log);
summary.errors.push(...news.errors);

log('Reading discussions…');
for (const q of HN_QUERIES) {
  try {
    for (const hit of await core.hnSearch(q, Math.floor((now - 7 * 864e5) / 1000))) {
      const item = toNewsItem({ title: hit.title, url: hit.link, text: hit.text, date: hit.date, outlet: 'Hacker News' }, 'Hacker News', now, { strict: true });
      if (item) news.items.push(item);
    }
  } catch (err) {
    note(`HN "${q}": ${err.message}`);
  }
  await core.sleep(300);
}

try {
  for (const q of BLUESKY_QUERIES) {
    try {
      for (const hit of await core.blueskySearch(q)) {
        const item = toNewsItem({ ...hit, outlet: 'Bluesky' }, 'Bluesky', now, { strict: true });
        if (item) news.items.push(item);
      }
    } catch (err) {
      note(`Bluesky "${q}": ${err.message}`);
    }
  }
} catch (err) {
  note(err);
}

for (const tag of ['gta6', 'gta']) {
  try {
    for (const hit of await core.mastodonTag(tag)) {
      const item = toNewsItem({ ...hit, outlet: 'Mastodon' }, 'Mastodon', now, { strict: true });
      if (item) news.items.push(item);
    }
  } catch (err) {
    note(`Mastodon #${tag}: ${err.message}`);
  }
}

try {
  for (const q of ['gta 6 xbox', 'gta vi port']) {
    try {
      for (const hit of await core.lemmySearch(q)) {
        const item = toNewsItem({ ...hit, outlet: 'Lemmy' }, 'Lemmy', now, { strict: true });
        if (item) news.items.push(item);
      }
    } catch (err) {
      note(`Lemmy "${q}": ${err.message}`);
    }
  }
} catch (err) {
  note(err);
}

try {
  for (const hit of await core.fourchanSearch('g', { maxThreads: 5 })) {
    const item = toNewsItem({ ...hit, outlet: '4chan /g/' }, '4chan /g/', now, { strict: true });
    if (item) news.items.push(item);
  }
} catch (err) {
  note(`4chan: ${err.message}`);
}

if (process.env.X_BEARER_TOKEN) {
  for (const q of NEWS_QUERIES.slice(0, 4)) {
    try {
      for (const hit of await core.xSearch(`${q} -is:retweet`, process.env.X_BEARER_TOKEN)) {
        const item = toNewsItem({ ...hit, outlet: 'X' }, 'X', now, { strict: true });
        if (item) news.items.push(item);
      }
    } catch (err) {
      note(`X "${q}": ${err.message}`);
    }
  }
}

try {
  const redditToken = await core.redditToken(process.env.REDDIT_CLIENT_ID, process.env.REDDIT_CLIENT_SECRET);
  for (const subreddit of REDDIT.subreddits) {
    for (const query of REDDIT.queries) {
      try {
        for (const hit of await core.redditSearch({ subreddit, query, token: redditToken })) {
          const item = toNewsItem({ ...hit, outlet: `r/${subreddit}` }, `r/${subreddit}`, now, { strict: true });
          if (item) news.items.push(item);
        }
      } catch (err) {
        note(`Reddit r/${subreddit}: ${err.message}`);
        break;
      }
      await core.sleep(1200);
    }
  }
} catch (err) {
  note(`Reddit: ${err.message}`);
}

/* ---------- Repositories, commits, pull requests ---------- */

log('Searching GitHub for new public projects…');
const repos = token
  ? await fetchRepos(token, new Date(now - 30 * 864e5).toISOString(), knownRepos, log)
  : { items: [], errors: ['no GITHUB_TOKEN, skipped repo search'] };
summary.errors.push(...repos.errors);
summary.repos = repos.items.length;

log('Reading commits and pull requests…');
const projectActivity = token
  ? await fetchProjectActivity(token, efforts, activityFile.projects ?? {}, log)
  : { projects: activityFile.projects ?? {}, errors: ['no GITHUB_TOKEN, skipped commits and pull requests'] };
summary.errors.push(...projectActivity.errors);
for (const p of Object.values(projectActivity.projects)) {
  summary.commits += p.commits?.length ?? 0;
  summary.pulls += p.pulls?.length ?? 0;
  summary.openPrs += p.openPrs ?? 0;
}

log('Searching pull requests across GitHub…');
const pullSearch = token
  ? await fetchPullSearch(token, idByRepo, log)
  : { items: [], errors: [] };
summary.errors.push(...pullSearch.errors);

const projects = { ...projectActivity.projects };
for (const pr of pullSearch.items) {
  const id = pr.projectId ?? idByRepo.get(pr.repo.toLowerCase());
  if (!id) continue;
  projects[id] = mergeProject(projects[id], { pulls: [pr] });
  summary.pulls++;
}

/* ---------- Merge ---------- */

const beforeNews = new Set((newsFile.items ?? []).map((n) => n.id));
const beforeFeed = new Set((activityFile.feed ?? []).map((f) => `${f.repo}#${f.number ?? f.sha}`));
const mergedNews = mergeNews(newsFile.items ?? [], news.items, { now });
const feed = mergeFeed(activityFile.feed ?? [], projects, now);
const discovered = mergeRepos(activityFile.discovered ?? [], repos.items.filter((r) => !knownRepos.has(r.repo.toLowerCase())), now);

summary.news = mergedNews.length;
summary.newNews = mergedNews.filter((n) => !beforeNews.has(n.id)).length;
const freshFeed = feed.filter((f) => !beforeFeed.has(`${f.repo}#${f.number ?? f.sha}`));

const nextNews = { updated: nowIso, items: mergedNews };
const nextActivity = { updated: nowIso, projects, feed, discovered };

const changed =
  JSON.stringify(nextNews.items) !== JSON.stringify(newsFile.items ?? []) ||
  JSON.stringify(nextActivity.projects) !== JSON.stringify(activityFile.projects ?? {}) ||
  JSON.stringify(nextActivity.feed) !== JSON.stringify(activityFile.feed ?? []) ||
  JSON.stringify(nextActivity.discovered) !== JSON.stringify(activityFile.discovered ?? []);

log('');
log(`${mergedNews.length} stories (${summary.newNews} new), ${summary.openPrs} open PRs, ${feed.length} activity items, ${discovered.length} public repos found.`);
log(`${summary.errors.length} errors.`);

if (!dryRun && changed) {
  await writeFile(new URL('news.json', root), `${JSON.stringify(nextNews, null, 2)}\n`);
  await writeFile(new URL('activity.json', root), `${JSON.stringify(nextActivity, null, 2)}\n`);
  log('Wrote data/news.json and data/activity.json');
} else if (!changed) {
  log('No change; nothing written.');
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Harvest',
      `${summary.newNews} new stories, ${freshFeed.length} new commits or pull requests, ${summary.repos} repos found.`,
      summary.errors.length
        ? `\n<details><summary>${summary.errors.length} errors</summary>\n\n${summary.errors.map((e) => `- ${e}`).join('\n')}\n</details>`
        : '',
      '',
    ].join('\n')
  );
}
