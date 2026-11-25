// A small client for AI models that answer without an account or a key. It sends no credentials and
// never throws: a run with no provider gets { ok: false, reason } and carries on without one.
//
// Only providers whose own documentation allows keyless use are listed. See docs/AUTOMATION.md.

const UA = 'viportlive/1.0';
const MAX_BODY = 400_000;
const ATTEMPTS = 2;
// Failures in a row before a provider is left alone for the rest of the run.
const STRIKES = 3;
const MAX_WAIT = 50_000;

export const PROVIDERS = [
  // "Free API Classic at text.pollinations.ai, which needs no account."
  // https://pollinations.ai/privacy (section 1). One reply every 45 seconds per address, of at most
  // 1,500 tokens with the reasoning counted.
  { name: 'Pollinations', url: 'https://text.pollinations.ai/openai', model: 'openai-fast', gapMs: 47_000, options: { reasoning_effort: 'minimal' } },
  // "Free models are available to both authenticated and anonymous users", 200 requests an hour.
  // https://kilo.ai/docs/gateway/models-and-providers
  // Models are named one by one: kilo-auto/free says it is not for production, and NVIDIA's free
  // endpoints behind it are for trials only.
  { name: 'Kilo Gateway', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'particle-ai/particle-1:free' },
  { name: 'Kilo Gateway', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'reflection/beam-free' },
];

const isHttps = (url) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

/** FREE_AI_BASE_URL and FREE_AI_MODEL go first. FREE_AI=off turns every provider off. */
export function providersFrom(env = {}) {
  if (env.FREE_AI === 'off') return [];
  const base = env.FREE_AI_BASE_URL?.trim().replace(/\/+$/, '');
  const model = env.FREE_AI_MODEL?.trim();
  if (base && model && isHttps(base)) {
    const url = /\/(chat\/completions|openai)$/.test(base) ? base : `${base}/chat/completions`;
    return [{ name: new URL(url).hostname, url, model }, ...PROVIDERS];
  }
  if (model && !base) return [{ ...PROVIDERS[0], model }, ...PROVIDERS];
  return PROVIDERS;
}

/** Retry-After as milliseconds: seconds or a date. Null without one. */
export function retryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) ? Math.max(0, ms) : null;
}

/** The JSON in a reply, with or without a code fence or words around it. */
export function parseJson(text) {
  if (typeof text !== 'string') return null;
  const from = text.search(/[{[]/);
  const to = text.lastIndexOf(text[from] === '[' ? ']' : '}');
  if (from < 0 || to <= from) return null;
  try {
    return JSON.parse(text.slice(from, to + 1));
  } catch {
    return null;
  }
}

/** A list that was cut off: what came through whole, closed again. */
export function salvage(text) {
  if (typeof text !== 'string') return null;
  const end = text.lastIndexOf('},');
  return end < 0 ? null : parseJson(`${text.slice(0, end + 1)}]}`);
}

const label = (model, fallback) =>
  typeof model === 'string' && /^[\w./:-]{1,80}$/.test(model) ? model : fallback;

async function call(provider, { system, user, maxTokens }, { fetch, timeoutMs }) {
  const res = await fetch(provider.url, {
    method: 'POST',
    redirect: 'error',
    credentials: 'omit',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      ...provider.options,
    }),
  });
  if (!res.ok) return { status: res.status, wait: retryAfter(res.headers.get('retry-after')) };
  const body = await res.text();
  if (body.length > MAX_BODY) return { status: 200, value: null };
  const reply = parseJson(body);
  const choice = reply?.choices?.[0];
  return {
    status: 200,
    value: parseJson(choice?.message?.content) ?? salvage(choice?.message?.content),
    note: choice?.finish_reason === 'length' ? 'cut off' : choice ? null : 'no text',
    model: label(reply?.model, provider.model),
  };
}

/**
 * ask() tries each provider in order and returns the first reply that fits the schema:
 * { ok: true, value, by } or { ok: false, reason }.
 */
export function createFreeAi({
  providers = PROVIDERS,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now,
  log = () => {},
  maxRequests = 8,
  budgetMs = 360_000,
  timeoutMs = 90_000,
  gapMs = 4000,
} = {}) {
  const until = now() + budgetMs;
  const strikes = new Map();
  const stats = { requests: 0, errors: [] };
  const last = new Map();

  const isDown = (p) => (strikes.get(p) ?? 0) >= STRIKES;
  const strike = (p, reason, all = false) => {
    strikes.set(p, all ? STRIKES : (strikes.get(p) ?? 0) + 1);
    const line = `${p.name} (${p.model}): ${reason}`;
    stats.errors.push(line);
    log(`  ! ${line}`);
  };
  const spent = () => (stats.requests >= maxRequests ? 'request cap' : now() >= until ? 'out of time' : null);

  async function ask({ system, user, schema, maxTokens = 6000 }) {
    for (const p of providers) {
      for (let attempt = 0; attempt < ATTEMPTS && !isDown(p); attempt++) {
        if (spent()) return { ok: false, reason: spent() };
        const pause = (last.get(p) ?? -Infinity) + (p.gapMs ?? gapMs) - now();
        if (pause > 0) await sleep(pause);
        if (spent()) return { ok: false, reason: spent() };
        stats.requests++;
        let reply;
        try {
          reply = await call(p, { system, user, maxTokens }, { fetch, timeoutMs: Math.max(1000, Math.min(timeoutMs, until - now())) });
        } catch (err) {
          reply = { status: 0, error: err?.name === 'TimeoutError' ? 'timed out' : 'no answer' };
        }
        last.set(p, now());
        if (reply.status === 200) {
          const parsed = schema.safeParse(reply.value);
          if (parsed.success) {
            strikes.set(p, 0);
            return { ok: true, value: parsed.data, by: `${p.name}, ${reply.model}` };
          }
          strike(p, `reply was not the JSON asked for${reply.note ? ` (${reply.note})` : ''}`);
          // The same question again would get the same answer, so the next provider has a go.
          break;
        }
        // 400 can be about one prompt. Pollinations says 402 with a Retry-After for its free limit. Nothing is ever paid.
        const temporary =
          reply.status === 0 || reply.status === 400 || reply.status === 429 || reply.status >= 500 || (reply.status === 402 && reply.wait !== null);
        const wait = reply.wait ?? 2000 * 2 ** attempt;
        // Told to stay away for longer than a run can wait, or never going to work: stop asking.
        strike(p, reply.error ?? `HTTP ${reply.status}`, !temporary || wait > MAX_WAIT);
        if (!isDown(p) && attempt + 1 < ATTEMPTS && now() + wait < until) await sleep(wait);
      }
    }
    return { ok: false, reason: providers.length ? 'no provider answered' : 'turned off' };
  }

  return { ask, stats };
}
