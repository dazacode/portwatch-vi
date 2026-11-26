# Intelligence desk: plan

An automated newsroom for VIPortLive, planned against the repo as it stands on 25 November 2026.
Nothing here is built yet. This is for the owner to approve, cut or reorder.

## Decisions taken

- **15 minutes**, not 5, until a measured trim proves the budget.
- **Auto-publish** high and moderate confidence. Low confidence, conflicts and anything the audit cannot
  stand behind stay in the queue. Everything is written to the repository so an agent can read, audit and
  correct it without a person in the loop.
- **JSON in git, written through `./pw`.** No database. The detector must be complete, not selective: every
  source gets a cursor and a coverage record, and a missed window is a visible defect.
- **Upstream's tracker is the baseline.** Every known build is fingerprinted before the first event, so the
  feed starts with deltas rather than re-announcing a hundred existing projects.
- **Discord posts at any hour.**

"Everything is added" means at-least-once detection with idempotent writes, not a best-effort scrape. A
source that lags, a pagination window that closes early, or a fetch that fails is recorded as an
`ingest-gap` item and backfilled, not silently skipped.

## Built

Phases 0 to 3 of this plan are in the tree: the ledger and hash chain, the baseline index, the detector
and gate, the free-model report and desk, the feed (as the News Reports tab), item pages, queue, RSS, JSON Feed, API, Discord and the 6-hour
audit. Nothing is deployed yet; the Discord secret has to be added in GitHub and the branch
merged. Phase 4 (comparator, overnight digest, daily desk issue, 5-minute trim) remains.

## Verdict

The proposal is sound in direction and about 60% already built. The site already harvests, deduplicates,
classifies and publishes stories; it already has an hourly model editor with guardrails, permanent article
URLs, a feed, evidence weighting and a searchable board. What it does **not** have is the thing that makes a
newsroom useful: a chronological, first-party record of **changes to the build database**, with a confidence
label, a review queue and something other accounts can cite.

So the plan is not "build a pipeline". It is:

1. index the **existing board** as a fingerprint baseline;
2. add a deterministic, complete **discovery ledger** for changes the harvest sees;
3. publish it as an **Intelligence feed** with permanent report URLs;
4. keep a **machine-readable review queue** and an **audit loop** that corrects itself;
5. distribute only what clears the queue.

Two recommendations differ from the proposal:

- **Stay on JSON in git, not PostgreSQL + BullMQ + Redis.** The dataset is tiny, there is one writer at a
  time, and upstream already died of a database under traffic. A queue and a database add two services and a
  second source of truth for no gain at this size. Revisit at ~5,000 events or when search needs ranking.
- **15 minutes, not 5**, with 5 available after a measured trim. The Actions token gets 1,000 REST calls an
  hour per repository. The current harvest uses about 90 a run; at 5 minutes that alone is 1,080 an hour
  before the scout, evidence pass or any new job.

## What the repo already does

| Piece                                                                                                                         | Where it is now                                                                              | Reusable?                             |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| Source monitoring (news, Bing/Google News, 14 outlets, HN, Reddit, Bluesky, Mastodon, Lemmy, 4chan, GitHub repos/commits/PRs) | `scripts/harvest.mjs`, `scripts/lib/harvest.mjs`, every 30 min                               | Yes, unchanged                        |
| Story filter (GTA VI **and** port work, lure filter, categories)                                                              | `scripts/lib/harvest.mjs`, `lib/live/filter.ts`                                              | Yes                                   |
| Deduplication                                                                                                                 | URL + title keys in `mergeNews`                                                              | Yes, and too weak: see fingerprinting |
| Discovery of new public repos                                                                                                 | `fetchRepos` → `activity.discovered`, shown on `/activity`                                   | Yes, but not scored or announced      |
| Evidence reading from issues                                                                                                  | `scripts/evidence.mjs`, `lib/verification.mjs`, weighted, author-hashed                      | Yes                                   |
| Automated articles                                                                                                            | `scripts/editor.mjs`, hourly, max 2/day, `./pw` only, guardrails in `scripts/lib/editor.mjs` | Yes, as the "major event" path        |
| Permanent article URLs                                                                                                        | `/news/[id]`, sitemap, JSON-LD                                                               | Yes, as a model                       |
| RSS                                                                                                                           | `/feed.xml`                                                                                  | Yes                                   |
| Digest with a free model                                                                                                      | `scripts/digest.mjs`, `data/digest.json`                                                     | Yes                                   |
| Searchable board                                                                                                              | `/standings` explorer with shareable filters                                                 | Yes                                   |
| Social image generation                                                                                                       | `/top-20/image`, `ImageResponse`                                                             | Yes                                   |
| Triggering                                                                                                                    | Cloudflare timer, `timer/worker.mjs`, because GitHub ignores fork schedules                  | Yes, add a job                        |
| Push-to-site                                                                                                                  | `/api/refresh` webhook + 60 s data cache                                                     | Yes                                   |

That is most of the hard operational work. The new job should **read** those outputs, not duplicate the
scraping.

## What is actually missing

| Ask                        | Gap                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Live intelligence feed     | No event ledger; board events are joined/inactive only; activity is a raw commit list      |
| Build fingerprinting       | URL/title dedupe only; no repo-identity or README similarity                               |
| Evidence cross-referencing | Per-project confidence exists; no cross-source event clustering or contradiction detection |
| Review queue               | The editor logs "held" internally; nothing is queued, visible or actionable                |
| Structured reports         | Articles are free prose with no confidence, evidence trail or unknown section              |
| Dynamic previews           | Only one site-wide OG image                                                                |
| Discord                    | Absent                                                                                     |
| JSON API                   | Internal routes only; no public, versioned feed                                            |
| Comparison                 | None                                                                                       |
| Overnight digest           | `digest.json` summarises scraped stories, not first-party findings                         |

## Architecture

```
upstream tracker ─> baseline index (once) ─┐
harvest cursors ───────────────────────────┤
scout / evidence ──────────────────────────┼─> detector (15 min) ─> event ─> gate ─┬─ published → report
DMCA / repo metadata ──────────────────────┘        │                              ├─ held → desk queue
                                                   │                              └─ duplicate → update
                                                   └─ coverage, fingerprint, cluster, conflict
audit (6 h) ─> re-check published ─> revision / demote / retract ─> correction
```

The detector is pure: it reads `data/*.json`, the coverage cursors and the baseline index, writes events
under rules, and makes no network calls. A separate `enrich` step fetches only the small GitHub metadata it
needs for an unfamiliar repo. The writer is a new workflow behind the existing `data-write` concurrency
group. The audit is the second half: it re-reads what was published and repairs the record.

### Why deterministic first

A model can write the report. It must not decide:

- whether an event happened;
- whether two sources are the same person or a repost;
- whether a claim conflicts with an earlier one;
- whether an item is published, held or a duplicate;
- any identifier or timestamp.

All of those are code. The model gets the four sections and a fixed set of source excerpts, and its prose
is rejected if it introduces a number or name that is not in them. Without a model, a deterministic
skeleton still produces a readable report, so a dead provider never stops the feed.

### Completeness and the baseline

The failure this design is built against is the quiet one: a source that stopped answering, a cursor that
jumped a page, a new repo that was seen and dropped. So:

- Every source has a cursor and a `coverage` row with `lastCursor`, `lastOkAt`, `seen`, `events`, `errors`.
- Detection reads forward from the cursor only. A run that finds nothing still writes `lastOkAt`.
- A source more than two intervals behind, or a page whose `hasNextPage` was ignored, creates an
  `ingest-gap` item. The next run backfills from the stored cursor. Gaps are held, never published.
- Writes are idempotent: the event key is a hash of kind, project, source URL and hour. A replay cannot
  duplicate an item or a report.
- `data/intel.json` carries a `chain` hash per item (`sha256(prev + id + at + fingerprint)`), so a rewrite,
  a lost item or a reorder is detectable by `./pw intel verify`.
- A coverage failure is loud: the job summary, a `coverage` Discord message to a second webhook, and a
  failed job once the gap is two intervals old. Nothing about it is left for the owner to notice.

Before the first event, `scripts/intel-baseline.mjs` indexes upstream's tracker (read-only), our overrides,
the evidence file and the activity history. It writes fingerprints and `since` markers for every known
build, plus a six-hour backfill window. A known build is never announced as new; the six hours behind the
baseline are read once so the feed does not open empty. This is also what gives duplicate detection a
populated reference set.

## Data

One new file, `data/intel.json`, append-only and pruned at 30 days:

```json
{
  "updated": "2026-11-26T12:03:00Z",
  "baselineAt": "2026-11-26T12:00:00Z",
  "coverage": {
    "activity": {
      "lastCursor": "2026-11-26T11:58:00Z",
      "lastOkAt": "2026-11-26T12:03:00Z",
      "seen": 412,
      "events": 3,
      "errors": 0
    }
  },
  "items": [
    {
      "id": "2026-11-26t1203-avatarmanz-issue-70",
      "kind": "reference | update | evidence | claim | takedown | duplicate | ingest-gap | audit",
      "projectId": "avatarmanz",
      "projectName": "AvatarManz",
      "at": "2026-11-26T11:58:00Z",
      "detectedAt": "2026-11-26T12:03:00Z",
      "title": "New test report on AvatarManz",
      "oneLine": "An RTX 4070 Ti SUPER session reached the prison yard.",
      "sources": [
        {
          "url": "https://github.com/avatarmanz/VIctory-7900XTX/issues/70",
          "host": "github.com",
          "outlet": "GitHub",
          "title": "Issue 70",
          "at": "2026-11-26T11:58:00Z",
          "kind": "primary",
          "authorHash": "a1b2c3"
        }
      ],
      "fingerprint": "sha256:…",
      "similar": [{ "effortId": "victory-gta6", "score": 0.81 }],
      "confidence": {
        "bucket": "low | moderate | high",
        "score": 0.55,
        "reasons": ["two independent sources", "one is the project's own repo"],
        "conflict": false
      },
      "status": "observed | held | published | retracted",
      "audit": null,
      "chain": "sha256:…",
      "reportId": "2026-11-26-avatarmanz-issue-70",
      "discordAt": null,
      "revisions": []
    }
  ],
  "reports": [
    {
      "id": "2026-11-26-avatarmanz-issue-70",
      "itemId": "2026-11-26t1203-avatarmanz-issue-70",
      "publishedAt": "2026-11-26T12:05:00Z",
      "by": "claude | rules",
      "confidence": "moderate",
      "overview": "…",
      "changed": "…",
      "evidence": "…",
      "unknown": "…",
      "sources": []
    }
  ]
}
```

- IDs are derived from a UTC minute, project id and a short source hash. Once written, never changed.
- Items and reports live in one file so a write is atomic. Reports cap at 300 words; sources are copied
  from the item, never typed by a model.
- `isHidden` (the PortWatch rule) filters every item and report before it reaches a page.

### Report shape

The four sections from the proposal are enforced, each 2–4 sentences: **Overview**, **What changed**,
**Supporting evidence**, **What remains unknown**. Titles are built by code from the event kind, not
invented. The page prints the confidence word, source count, timestamps, `Automated report` and the
correction history. "What remains unknown" always includes that authenticity and release implications are
unverified.

## Fingerprinting

A candidate is compared with every tracked effort and the last 30 days of items on:

- normalised repo owner/name and redirect history;
- a shingle hash of the README's first 800 characters, minus badges and headings;
- the set of credit names in the README (`basedOn` text, "based on");
- release asset names and window titles mentioned in the README.

Jaccard ≥ 0.6 flags a probable duplicate. It never auto-merges. A duplicate becomes an `update` on the
original ("also published as …") and cannot publish its own report. This is also the guard against a
fork wave filling the feed.

### Anti-gaming

Projects have an incentive to look further along than they are, and the feed is a new surface to game.

- A source on a project's own repo is **primary but not independent**. It can lift an event to moderate,
  never to high on its own.
- Issue authors are hashed and counted once; an account younger than seven days or with no other history
  counts half. The same person commenting three times is one voice.
- README text only counts when the same claim is not already in an older README (a re-worded unchanged
  sentence is not an event). Numbers are parsed from the sentence, not inferred.
- A commit that only bumps a version, edits a badge or changes whitespace is not an event.
- A fork whose README is ≥ 0.9 similar to its parent cannot generate a "new build" event, only a
  "reference" note on the parent.
- A claim that appears first in a video with no repo, no commit and no outside report is low by rule.

## Confidence and the publication gate

Confidence reuses the existing evidence weights, capped by **independent authors**, not source count:
two reposts of one tweet are one source. Buckets:

| Bucket   | Rule                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| High     | 3+ independent sources, at least one project repo/release or watched live challenge, no conflict |
| Moderate | 2 independent sources, or a project repo plus one outside report, no conflict                    |
| Low      | one source, a social post alone, or anything conflicting                                         |

Automatic publication for **high and moderate**. Always held: low confidence, conflicts, duplicates,
claims about the executable or a leak, takedowns without a primary link, anything the DMCA log
contradicts, and any open `ingest-gap` on the item's source.

Caps per run: 3 reports. Per day: 8 published. One report per project per 6 hours. Dedupe window: 7 days.
A cap never drops an event; it holds it. A held item stays in the feed marked "Under investigation" and
can be published by `./pw intel publish` or by the desk agent once corroborated.

## Audit and self-correction

`intel-audit.yml` runs every 6 hours. For every published item it re-fetches the sources (HEAD, then the
body for the primary), and checks four things:

- the link still answers (200 or a permanent redirect that resolves);
- the primary source still contains the item's key number, frame rate, stage or repo;
- no newer item from a more independent source contradicts it;
- the confidence still recomputes to its bucket.

Each failure writes an `audit` item and one of four outcomes:

| Finding                                 | Outcome                                               |
| --------------------------------------- | ----------------------------------------------------- |
| Link dead or moved                      | `revision`, new URL or a note; report stays published |
| Source edited and no longer supports it | demote to `held`, unlist, queue for a rewrite         |
| Contradicted by a stronger source       | `retract`, correction banner, Discord correction      |
| Confidence dropped                      | demote and queue; no text change                      |

Nothing is deleted. `./pw intel verify` re-walks the chain; `./pw intel audit --json` reports drift; a
repair is `./pw intel repair <id> --source <url>`. An agent may do all three. Automatic repair is limited
to link moves and text that still supports the claim: a rewrite of prose is a new revision, never a silent
edit.

## Agent desk

The queue is a file and a CLI, so the owner's Claude, another agent or a GitHub bot can work it without a
browser:

```sh
./pw intel queue --json                 # held, with reasons and source excerpts
./pw intel show <id> --json
./pw intel source <id> <url>            # read one source, stored excerpt only
./pw intel publish <id> --note "…"
./pw intel retract <id> --reason "…"
./pw intel audit --json
./pw check --json
```

The contract is in `docs/INTEL-DESK.md`: check the primary source, add a source rather than rewriting a
claim, publish only with a reason, retract rather than overwrite, and leave a note on every state change.
`intel.yml` prints the queue in its job summary. A daily "Intelligence desk" issue is optional in phase 4,
one issue a day, updated in place, so an agent has a GitHub surface without issue-command parsing.

## Pages and distribution

- `/news?show=reports` — the chronological feed, as the News page's Reports tab (server-rendered, 60 s
  revalidate, cursor pagination, project/kind/confidence filters). `/intelligence` permanently redirects
  here. Held items show "Under investigation" and link to their item page.
- `/intelligence/[id]` — the report or the held item, permanent URL, `noindex` while held. JSON-LD
  `NewsArticle` with `dateModified`. A share control uses `navigator.share`, then clipboard.
- `/intelligence/queue` — unlisted, `noindex`, newest first, with the `./pw` command and a
  `workflow_dispatch` link to publish or retract. This is the review queue.
- `/compare?a=…&b=…` — two builds side by side: claim fields, deltas, evidence counts, shared base, links.
- Home — five newest items under the standings.
- Nav — News carries the Reports tab; there is no separate Intelligence item.
- `/intelligence/feed.xml`, `/intelligence/feed.json` (JSON Feed 1.1), `/api/v1/intel`,
  `/api/v1/intel/[id]` (CORS `*`, documented). RSS items carry the report body and the confidence word.
- Discord: only after a successful publish. One embed per report, deduplicated on `discordAt`, `429`
  handled from `retry_after`, three attempts, then the next run. Posts at any hour; corrections post as a
  reply-style message pointing at the same URL.
- OG: `/intelligence/[id]/opengraph-image.tsx`, a branded card with the section label, confidence,
  source count and date. Reuses the `top-20` palm/colour code. No game image: the site's rule is that a
  leaked-build frame cannot be told apart automatically.

## Cadence and budget

New workflow `intel.yml`, `5,20,35,50 * * * *`, dispatched by the timer every 15 minutes at minute 5.
It shares `data-write`, writes only `data/intel.json`, commits only when the bytes changed.

| Call                                    | Per run | Per hour          |
| --------------------------------------- | ------- | ----------------- |
| GitHub REST (enrichment and audit only) | 0–40    | ≤160              |
| Model (reports)                         | 0–3     | ≤12               |
| Existing harvest                        | —       | ~180              |
| Scout/evidence/sync                     | —       | ~120              |
| **Total**                               |         | **~460 of 1,000** |

`intel-audit.yml` runs every 6 hours and adds at most 25 reads, well inside the same budget. A 5-minute
schedule needs the enrich step moved to GraphQL, the harvest trimmed to Atom and one call per project, and
a measured run showing <60 calls. That is a phase 4 change, not a launch setting.

### Setup

1. Repository secret `DISCORD_WEBHOOK_URL` with the channel's webhook. Without it, nothing is sent and
   the run still succeeds.
2. Leave `FREE_AI` unset for the keyless providers, or set the repository variable `FREE_AI=off` to
   publish skeletons only.
3. Enable Actions in the fork. The Cloudflare timer starts `intel.yml` at :05, :20, :35 and :50; GitHub's
   own schedule is a fallback.
4. The first run creates the baseline if `baselineAt` is null. Check `/intelligence/queue` after it.

## Failure modes

| Failure                          | Behaviour                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Provider down                    | Skeleton report; a dead model never stops the feed                              |
| GitHub rate limited              | Read `x-ratelimit-reset`, stop enriching, keep detecting from local data        |
| Source 404 after publish         | Audit writes a `revision`; the report stays up with a moved-link note           |
| Source lag or a skipped page     | `ingest-gap` item, backfill from the stored cursor, held until closed           |
| Baseline index missing           | The run refuses to publish and says so, rather than announcing the whole board  |
| Push refused                     | Rebase retry like `editor.yml`, then fail the run                               |
| Discord 429/404                  | Leave `discordAt` null (429) or clear the webhook flag (404), never retry a 404 |
| Runaway commits                  | Caps above; a run with no new event writes only its coverage row                |
| Model invents a number           | Rejected by the source check, fall back to the skeleton                         |
| Wrong publish                    | Audit's `retract`, a revision and a correction banner; feeds and Discord update |
| `data/intel.json` edited by hand | `./pw intel verify` fails the chain; `intel.yml` refuses to write               |

## Guardrails that must not change

- `data/tracker.json` untouched; all decisions in `data/intel.json`, written through `./pw`.
- Findings still need https sources; `./pw check` extended to intel.
- The AI never moves a score, `verification`, tier or `evidence` by itself. Intelligence is about the
  discovery; the score still comes from `lib/rating.mjs` and the editor.
- No leaked-game, executable or Discord image in a report or preview.
- No model-written links; links come from stored source ids.
- Public information only; no binaries, no game files, no scraping behind a login.
- One writer: `intel.yml` and `intel-audit.yml` share `data-write`, and only `./pw` writes the ledger.
- Every state change leaves a reason, an actor and a timestamp.

## Phases

| Phase | Work                                                                                                                                                               | Days |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 0     | Schema, chain, `./pw intel` (`list/show/hold/publish/retract/verify`), validation, fixtures, `docs/INTEL-DESK.md`                                                  | 2.5  |
| 1     | Baseline index from upstream/overrides/evidence; cursors and coverage; detector for evidence, milestone, takedown and README-claim events; fingerprint and cluster | 4    |
| 2     | Gate and confidence, report generator (model + skeleton), source check, `/intelligence` feed and pages, queue page                                                 | 4    |
| 3     | Audit workflow and repairs; publish/retract dispatch; RSS, JSON Feed, API, Discord, OG cards, share                                                                | 4    |
| 4     | Comparator, overnight digest, home module, daily desk issue, 5-minute trim if the budget holds                                                                     | 3    |

Roughly 14 working days to phase 3. Phase 1 runs behind a temporary flag that writes everything as held;
the real gate arrives in phase 2 and can be flipped from held-everything to auto-publish without a deploy
while the first days are watched. Each phase ends green on `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build` and `./pw check`.

## Tests

Unit, fixture-driven, no network: cursor advance and replay, idempotent event keys, baseline suppression,
fingerprint match and non-match, repost clustering, conflict detection, bucket arithmetic, gate decisions,
ID stability, chain verification, report number/name validation, skeleton fallback, audit outcomes,
pruning, API shape, RSS/JSON escaping, Discord payload and `retry_after`, `noindex` on held.

Two end-to-end fixture directories: one runs the detector twice and asserts no duplicate and no second
write; one publishes, moves a source, runs the audit and asserts a revision rather than a deletion.

## How we will know it works

- median public-event → feed latency, target under 20 minutes;
- source coverage: share of runs with no open gap, target 100%;
- audit catches, and how many were repaired without a person;
- published items corrected within 48 h, target under 5%;
- queue age, target under 24 hours; held rate;
- citations and referrals from accounts that are not us;
- feed and API subscribers;
- zero false "authentic" claims, zero leaked-image previews.

## Decisions needed

Settled: 15 minutes; auto-publish high and moderate; JSON in git; upstream as the baseline; Discord at any
hour. Still open when building starts:

1. the Discord webhook URL as the `DISCORD_WEBHOOK_URL` secret;
2. an `ANTHROPIC_API_KEY` for report prose, or free models with `INTEL_FREE_ALL=1`;
3. whether the desk agent may publish from the queue without asking, or only draft;
4. confirmation that "Intelligence" gets a nav slot and a home module.

## Files

New: `docs/INTELLIGENCE.md` (this), `docs/INTEL-DESK.md`, `data/intel.json`, `lib/intel.ts`,
`lib/intel-fingerprint.mjs`, `lib/intel-gate.mjs`, `scripts/intel.mjs`, `scripts/intel-baseline.mjs`,
`scripts/intel-audit.mjs`, `scripts/lib/intel/*.mjs`, `scripts/cli/commands/intel.mjs`,
`.github/workflows/intel.yml`, `.github/workflows/intel-audit.yml`, `app/intelligence/*`,
`app/api/v1/intel/*`, `components/intel/*`, `tests/intel-*.test.ts`.

Touched: `scripts/pw.mjs`, `scripts/cli/commands/read.mjs` (check), `lib/hide.ts`, `lib/sitemap.ts`,
`components/site-header.tsx`, `app/page.tsx`, `timer/worker.mjs`, `docs/AUTOMATION.md`, `.env.example`.
