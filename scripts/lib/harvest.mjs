// Harvests everything public about the GTA VI PC-port scene: news, discussions, repositories,
// commits and pull requests. Network calls live here so the script stays a thin loop.
import { isRelevant, newsFeed, sleep, UA } from './core.mjs';

const DAY = 864e5;
const NEWS_TTL_DAYS = 21;
const NEWS_CAP = 400;
const ACTIVITY_TTL_DAYS = 45;
const REPO_TTL_DAYS = 14;
const MAX_COMMITS = 15;
const MAX_PRS = 20;
const MAX_FEED = 250;
const MAX_DISCOVERED = 40;

/* ---------- News sources ---------- */

// Every feed is read every run; the relevance filter throws most of it away.
export const FEEDS = [
  ['Google News', (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:3d&hl=en-US&gl=US&ceid=US:en`],
  ['Bing News', (q) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`],
];

export const NEWS_QUERIES = [
  'GTA 6 PC port',
  'GTA VI PC',
  'GTA 6 leak',
  'GTA 6 emulator',
  'GTA 6 recompilation',
  'GTA 6 Xbox build',
  'Take-Two GTA 6 DMCA',
  'Cyberleek',
  'Leonida GTA 6',
  'GTA 6 reverse engineering',
];

// Outlet feeds. Their whole feed is filtered, not searched.
export const OUTLET_FEEDS = [
  ['PC Gamer', 'https://www.pcgamer.com/rss/'],
  ['DSOGaming', 'https://www.dsogaming.com/feed/'],
  ['XDA Developers', 'https://www.xda-developers.com/feed/'],
  ['VideoGamer', 'https://www.videogamer.com/feed/'],
  ['Eurogamer', 'https://www.eurogamer.net/feed'],
  ['VGC', 'https://www.videogameschronicle.com/feed/'],
  ['Rockstar Intel', 'https://rockstarintel.com/feed/'],
  ['MP1st', 'https://mp1st.com/feed'],
  ['Push Square', 'https://www.pushsquare.com/feeds/latest'],
  ['TechRadar', 'https://www.techradar.com/rss'],
  ['GamesRadar', 'https://www.gamesradar.com/rss/'],
  ['PCGamesN', 'https://www.pcgamesn.com/feed'],
  ['Tom’s Hardware', 'https://www.tomshardware.com/rss'],
  ['Game Rant', 'https://www.gamerant.com/feed/'],
];

export const HN_QUERIES = ['gta 6 xbox', 'gta vi port', 'gta 6 emulator', 'xbox series emulator'];
export const BLUESKY_QUERIES = ['gta 6 pc', 'gta vi port', 'leonida'];
export const REDDIT = {
  subreddits: ['GTA6', 'pcgaming', 'Games', 'emulation', 'EmulationOnPC', 'GamePreservation'],
  queries: ['gta 6 xbox pc', 'gta vi recomp', 'scarlett emulator', 'gta 6 port github'],
};

export const REPO_QUERIES = [
  'gta6 port pushed:>={since}',
  'gta vi recomp pushed:>={since}',
  'gta 6 xbox pushed:>={since}',
  'xbox series emulator pushed:>={since}',
  'leonida gta pushed:>={since}',
];

export const PR_QUERIES = [
  'gta6 type:pr',
  '"gta 6" port type:pr',
  '"gta vi" type:pr',
  'leonida type:pr',
  'recomp gta type:pr',
];

/* ---------- Filters and shapes ---------- */

const GTA = /(gta ?(vi|6)\b|grand theft auto (vi|6)\b|leonida\b|cyberleek)/i;
const PORT = /\b(pc|port|ports|ported|leak|leaked|recomp\w*|emulat\w*|dmca|take-?two|takedown|lawsuit|rockstar|executable|exe|xbox|build|github|mod\w*|reverse[- ]engineer\w*|decomp\w*|shader|d3d12)\b/i;

/** True for a story about running (or failing to run) GTA VI on PC. */
export function isPortStory(text, { strict = false } = {}) {
  const s = String(text ?? '');
  if (!GTA.test(s)) return false;
  if (!strict) return PORT.test(s);
  // Social posts: a bare "PC" or "mod" is usually chatter, so ask for port work or a result.
  return /\b(port|ports|ported|recomp\w*|emulat\w*|github|dmca|takedown|leak\w*|executable|exe|xbox|xgameruntime|d3d12|scarlett)\b/i.test(s)
    || /\bpc\b[^.\n]{0,50}\b(runs?|running|rn|playable|plays|working|works|boots?|booted|build|built)\b/i.test(s)
    || /\b(runs?|running|playable|works?|boots?|booted)\b[^.\n]{0,30}\bon\s+(?:my\s+|a\s+)?pc\b/i.test(s);
}

const CATEGORIES = [
  ['Takedown', /dmca|takedown|taken down|delist|nuked|disabled|forks? (shut|disabled)/i],
  ['Legal', /lawsuit|court|legal|subpoena|injunction|terms of service/i],
  ['Security', /malware|scam|fake|virus|stealer|miner|phishing|bait/i],
  ['Official', /rockstar|take-two|2k games|official|confirm|statement|announce|ceo|earnings/i],
  ['Leak', /leak|executable|\.exe|xbox build|build 6|dev build/i],
  ['Port', /port|recomp|emulat|compat|layer|translator|relink|shader|github|source code|open source/i],
];

export function categoryOf(text) {
  const s = String(text ?? '');
  for (const [name, re] of CATEGORIES) if (re.test(s)) return name;
  return 'Community';
}

export const normalizeTitle = (title) =>
  String(title ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const normalizeUrl = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`
      .toLowerCase()
      .replace(/[?#].*$/, '');
  } catch {
    return String(url ?? '').toLowerCase();
  }
};

/** A stable id for a story; the same story from two feeds collapses to one id. */
export const storyId = (item) => {
  const title = normalizeTitle(item.title).slice(0, 90).replace(/ /g, '-');
  const host = normalizeUrl(item.url ?? item.link).split('/')[0];
  return `${String(item.date ?? '').slice(0, 10)}-${host}-${title}`.slice(0, 180);
};

const cleanTitle = (t) =>
  String(t ?? '')
    // The outlet after the last separator. One without spaces is a hyphen in a name, such as Take-Two.
    .replace(/\s+[-|–]\s+[^|–]{2,40}$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

const validDate = (d, now) => {
  const t = Date.parse(d ?? '');
  return Number.isFinite(t) && now - t < NEWS_TTL_DAYS * DAY && t - now < 3 * DAY;
};

/** Drops dead, off-topic and duplicate stories, then keeps the newest per story and the newest N. */
export function mergeNews(existing, fresh, { now = Date.now(), cap = NEWS_CAP } = {}) {
  const seen = new Map();
  for (const item of [...fresh, ...existing]) {
    if (!item?.title || !(item.url ?? item.link)) continue;
    if (!validDate(item.date, now)) continue;
    const key = normalizeTitle(item.title).slice(0, 90);
    const urlKey = normalizeUrl(item.url ?? item.link);
    if (seen.has(key) || [...seen.values()].some((v) => normalizeUrl(v.url) === urlKey)) continue;
    seen.set(key, item);
  }
  return [...seen.values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, cap)
    .map((item) => ({
      ...item,
      id: item.id ?? storyId(item),
      url: item.url ?? item.link,
      category: item.category ?? categoryOf(`${item.title} ${item.text ?? ''}`),
    }));
}

export function toNewsItem(raw, via, now = Date.now(), { strict = false } = {}) {
  const title = cleanTitle(raw.title);
  const url = raw.url ?? raw.link;
  // Social posts carry a lot of noise in their body; their headline is the honest signal.
  const text = strict ? `${title} ${raw.description ?? ''}` : `${title} ${raw.text ?? ''} ${raw.description ?? ''}`;
  if (!title || !url || !/^https?:\/\//.test(url) || !isPortStory(text, { strict })) return null;
  const parsed = Date.parse(raw.date ?? '');
  if (!Number.isFinite(parsed) || now - parsed > NEWS_TTL_DAYS * DAY || parsed - now > 3 * DAY) return null;
  const date = new Date(parsed).toISOString();
  return {
    id: storyId({ title, url, date }),
    title,
    url,
    outlet: String(raw.outlet ?? via ?? 'the web').slice(0, 80),
    date,
    via,
    category: categoryOf(text),
    ...(raw.score ? { score: raw.score } : {}),
  };
}

/* ---------- Activity shapes ---------- */

const cleanMessage = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);

/** Normalises a GitHub commits API entry. */
export function toCommit(raw, projectId, repo) {
  const c = raw.commit ?? raw;
  const at = c.author?.date ?? raw.at;
  if (!raw.sha || !Number.isFinite(Date.parse(at ?? ''))) return null;
  return {
    projectId,
    repo,
    sha: String(raw.sha).slice(0, 7),
    message: cleanMessage(String(c.message ?? '').split('\n')[0]) || 'No message',
    author: String(c.author?.name ?? raw.author?.login ?? '').slice(0, 60),
    at,
    url: raw.html_url ?? `https://github.com/${repo}/commit/${raw.sha}`,
  };
}

/** Normalises a GitHub pull request (REST or search) entry. */
export function toPull(raw, projectId, repo) {
  const pr = raw.pull_request ?? {};
  const number = raw.number;
  if (!number) return null;
  const at = raw.updated_at ?? raw.created_at;
  return {
    projectId,
    repo,
    number,
    title: cleanMessage(raw.title),
    state: pr.merged_at || raw.merged_at ? 'merged' : raw.state === 'open' ? 'open' : 'closed',
    draft: Boolean(raw.draft),
    author: String(raw.user?.login ?? '').slice(0, 60),
    at: Number.isFinite(Date.parse(at ?? '')) ? at : new Date(0).toISOString(),
    url: raw.html_url ?? `https://github.com/${repo}/pull/${number}`,
  };
}

const byNewest = (a, b) => Date.parse(b.at) - Date.parse(a.at);

/** Merges one project's activity without duplicates and trims history. */
export function mergeProject(previous = {}, { commits = [], pulls = [] } = {}, now = Date.now()) {
  const dedupe = (list, oldList, keyOf, cap) => {
    const seen = new Set();
    return [...list, ...oldList]
      .filter((x) => x && x.at && now - Date.parse(x.at) < ACTIVITY_TTL_DAYS * DAY)
      .filter((x) => {
        const k = keyOf(x);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort(byNewest)
      .slice(0, cap);
  };
  return {
    openPrs: pulls.length,
    commits: dedupe(commits, previous.commits ?? [], (c) => c.sha, MAX_COMMITS),
    pulls: dedupe(pulls, previous.pulls ?? [], (p) => `${p.number}:${p.state}`, MAX_PRS),
  };
}

/** Merges commit/PR lists across projects into one newest-first feed. */
export function mergeFeed(previous, projects, now = Date.now()) {
  const fresh = Object.values(projects).flatMap((p) => [...(p.pulls ?? []), ...(p.commits ?? [])]);
  const seen = new Set();
  return [...fresh, ...(previous ?? [])]
    .filter((x) => x?.url && x.at && now - Date.parse(x.at) < ACTIVITY_TTL_DAYS * DAY)
    .filter((x) => {
      const k = `${x.repo}#${x.number ?? x.sha}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort(byNewest)
    .slice(0, MAX_FEED);
}

export function mergeRepos(previous, fresh, now = Date.now()) {
  const seen = new Set();
  return [...fresh, ...(previous ?? [])]
    .filter((r) => r?.repo && r.pushedAt && now - Date.parse(r.pushedAt) < REPO_TTL_DAYS * DAY)
    .filter((r) => {
      if (seen.has(r.repo.toLowerCase())) return false;
      seen.add(r.repo.toLowerCase());
      return true;
    })
    .sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt))
    .slice(0, MAX_DISCOVERED);
}

export function emptyActivity(now = Date.now()) {
  return { updated: new Date(now).toISOString(), projects: {}, feed: [], discovered: [] };
}

/* ---------- Source readers ---------- */

async function text(url, { token, accept = 'application/vnd.github+json' } = {}) {
  const headers = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  headers['User-Agent'] = UA;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  if (res.status === 403 || res.status === 429) {
    const err = new Error(`rate limited (${res.status})`);
    err.rate = true;
    throw err;
  }
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchNews(now = Date.now(), log = console.log) {
  const out = [];
  const errors = [];
  for (const q of NEWS_QUERIES) {
    for (const [via, build] of FEEDS) {
      try {
        for (const raw of await newsFeed(build(q), via)) {
          const item = toNewsItem(raw, via, now);
          if (item) out.push(item);
        }
      } catch (err) {
        errors.push(`${via} "${q}": ${err.message}`);
      }
    }
    await sleep(350);
  }
  for (const [outlet, url] of OUTLET_FEEDS) {
    try {
      for (const raw of await newsFeed(url, outlet)) {
        const item = toNewsItem(raw, outlet, now);
        if (item) out.push(item);
      }
    } catch (err) {
      errors.push(`${outlet}: ${err.message}`);
      log(`  ! ${outlet}: ${err.message}`);
    }
  }
  return { items: out, errors };
}

/** GitHub search for repositories in the scene. Uses the token Actions provides. */
export async function fetchRepos(token, sinceIso, known = new Set(), log = console.log) {
  const out = [];
  const errors = [];
  const since = sinceIso.slice(0, 10);
  for (const template of REPO_QUERIES) {
    const q = template.replace('{since}', since);
    try {
      const p = new URLSearchParams({ q, sort: 'stars', order: 'desc', per_page: '30' });
      const json = await text(`https://api.github.com/search/repositories?${p}`, { token });
      for (const r of json.items ?? []) {
        if (r.fork || r.archived || r.disabled || known.has(r.full_name.toLowerCase())) continue;
        const meta = {
          fullName: r.full_name,
          name: r.name,
          description: r.description ?? '',
          stars: r.stargazers_count ?? 0,
          pushedAt: r.pushed_at,
          language: r.language,
        };
        const blob = `${r.name} ${r.description ?? ''} ${(r.topics ?? []).join(' ')}`;
        if (!isRelevant(meta) || !isPortStory(blob)) continue;
        out.push({
          repo: r.full_name,
          description: String(r.description ?? '').slice(0, 200),
          stars: r.stargazers_count ?? 0,
          pushedAt: r.pushed_at,
          language: r.language ?? null,
          url: r.html_url,
        });
      }
    } catch (err) {
      errors.push(`repos "${q}": ${err.message}`);
      log(`  ! repos "${q}": ${err.message}`);
    }
    await sleep(1100);
  }
  return { items: mergeRepos([], out), errors };
}

/** Pull requests the projects themselves published. */
export async function fetchProjectActivity(token, efforts, previous = {}, log = console.log) {
  const projects = { ...previous };
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const e of efforts) {
    if (!e.repo || e.nuked || e.stats?.missing) continue;
    const repo = e.repo;
    try {
      const [commitsRaw, pullsRaw] = await Promise.all([
        text(`https://api.github.com/repos/${repo}/commits?per_page=${MAX_COMMITS}`, { token }),
        text(`https://api.github.com/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${MAX_PRS}`, { token }),
      ]);
      const commits = (Array.isArray(commitsRaw) ? commitsRaw : [])
        .map((c) => toCommit(c, e.id, repo))
        .filter(Boolean);
      const pulls = (Array.isArray(pullsRaw) ? pullsRaw : [])
        .map((p) => toPull(p, e.id, repo))
        .filter(Boolean);
      projects[e.id] = mergeProject(projects[e.id], { commits, pulls });
    } catch (err) {
      errors.push(`${repo}: ${err.message}`);
      log(`  ! ${repo}: ${err.message}`);
    }
    await sleep(120);
  }
  return { projects, errors };
}

/** Pull requests anywhere on GitHub that talk about a GTA VI port. */
export async function fetchPullSearch(token, idByRepo = new Map(), log = console.log) {
  const out = [];
  const errors = [];
  for (const q of PR_QUERIES) {
    try {
      const p = new URLSearchParams({ q, sort: 'updated', order: 'desc', per_page: '50' });
      const json = await text(`https://api.github.com/search/issues?${p}`, { token });
      for (const raw of json.items ?? []) {
        if (!raw.pull_request) continue;
        const repo = String(raw.repository_url ?? '').split('/repos/')[1];
        if (!repo) continue;
        const item = toPull(raw, idByRepo.get(repo.toLowerCase()) ?? null, repo);
        if (item) out.push(item);
      }
    } catch (err) {
      errors.push(`pull search "${q}": ${err.message}`);
      log(`  ! pull search "${q}": ${err.message}`);
    }
    await sleep(1100);
  }
  return { items: out, errors };
}

export { MAX_COMMITS, MAX_PRS };
