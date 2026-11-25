// Finds stream channels in project READMEs. Pure functions, so they can be tested without a network.

const RESERVED = {
  twitch: new Set(['directory', 'videos', 'p', 'settings', 'downloads', 'jobs', 'turbo', 'search']),
  kick: new Set(['browse', 'video', 'categories', 'search', 'about', 'following']),
};

const PATTERNS = [
  ['twitch', /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]{3,25})(?![\w/])/g],
  ['kick', /(?:https?:\/\/)?(?:www\.)?kick\.com\/([A-Za-z0-9_-]{3,30})(?![\w/-])/g],
  ['youtube', /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(@[\w.-]{3,30})/g],
  ['youtube', /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/(UC[\w-]{22})/g],
  ['rumble', /(?:https?:\/\/)?(?:www\.)?rumble\.com\/((?:user|c)\/[\w-]{2,40})/g],
];

export const key = (c) => `${c.platform}:${c.handle.toLowerCase()}`;

export function findChannels(text) {
  const found = new Map();
  for (const [platform, re] of PATTERNS) {
    for (const [, raw] of text.matchAll(re)) {
      const handle = raw.replace(/[.-]+$/, '');
      if (RESERVED[platform]?.has(handle.toLowerCase())) continue;
      found.set(key({ platform, handle }), { platform, handle });
    }
  }
  return [...found.values()];
}

/**
 * Rebuilds the registry. Manual entries are never touched. README entries follow the README: they
 * appear with the link and go with it, or when the project is taken offline. A project whose README
 * could not be read this time (missing from `readmes`) keeps what it had.
 */
export function mergeChannels(current, efforts, readmes) {
  const gone = new Set(efforts.filter((e) => e.nuked || e.stats?.missing).map((e) => e.id));
  const known = new Set(efforts.map((e) => e.id));
  const next = new Map();
  for (const c of current) if (c.addedBy === 'manual') next.set(key(c), c);
  for (const c of current) {
    const keep = c.addedBy === 'readme' && known.has(c.effortId) && !gone.has(c.effortId) && !readmes.has(c.effortId);
    if (keep && !next.has(key(c))) next.set(key(c), c);
  }
  for (const e of efforts) {
    if (gone.has(e.id)) continue;
    for (const found of findChannels(readmes.get(e.id) ?? '')) {
      if (next.has(key(found))) continue;
      const name = found.handle.replace(/^@|^(?:user|c)\//, '');
      next.set(key(found), { ...found, name, effortId: e.id, addedBy: 'readme' });
    }
  }
  return [...next.values()];
}
