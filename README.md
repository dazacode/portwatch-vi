# VIPortLive

Shows who is streaming work on running GTA VI on PC, and how far each project has got. A fork of
[PortWatch VI](https://github.com/4lwayz/portwatch-vi) by 4lwayz with a new front end (Next.js,
shadcn/ui on Base UI, Tailwind), live stream tracking and its own score and ranking. The projects and
their claims come from upstream.

    pnpm install
    pnpm dev

| Command                                      | What it does                                               |
| -------------------------------------------- | ---------------------------------------------------------- |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | Checks, also run in CI                                     |
| `./pw` (or `pnpm pw`)                        | Editorial CLI: inspect, score, findings, news, candidates  |
| `pnpm scout:dry`                             | Runs the project scout without saving (set `GITHUB_TOKEN`) |
| `pnpm harvest:dry`                           | Runs the news/commit/PR harvester without saving           |
| `pnpm channels:dry`                          | Shows which stream channels would be added or dropped      |
| `pnpm intel:dry`                             | Runs the intelligence detector without saving              |

## Where things are

- `lib/live/`: one file per platform, the title filter, and the snapshot that joins them
- `data/channels.json`: channels being followed. Entries with `"addedBy": "manual"` are yours; the
  `"readme"` ones are managed by `scripts/channels.mjs`
- `data/news.json`: every scraped story, headline and discussion, newest first
- `data/activity.json`: public commits, pull requests and newly found repositories per project
- `data/tracker.json`: upstream's projects, claims and headlines, exactly as they wrote them. Don't edit
- `data/overrides.json`: what we found ourselves, applied on top. Edit this one
- `data/intel.json`: the intelligence ledger, queue and reports; written by `./pw intel`
- `data/scores.json`: the claims of the last run, for milestones
- `app/news/`, `app/activity/`: the story feed and the public commit/PR log
- `app/intelligence/`: the discovery feed, reports and the queue; `docs/INTELLIGENCE.md` is the plan
- `lib/scoring.mjs`: upstream's scale for claims, a copy of their `assets/js/scoring.js`
- `lib/rating.mjs`: our score, from the claim and the evidence
- `scripts/cli/`, `pw`: the editorial CLI; see [docs/CLI.md](docs/CLI.md)

How the automation works, and why, is in [docs/AUTOMATION.md](docs/AUTOMATION.md). Editorial changes go
through the CLI: [docs/CLI.md](docs/CLI.md). Upstream's tracker is read live, and copied here every 15
minutes.

## Deploy

1. Import the repo in Vercel. The defaults work.
2. Add the keys from `.env.example` that you have.
3. In GitHub, open the Actions tab and enable workflows. GitHub turns them off in forks.

## Rules

Never link to, name or describe ways to get game files, executables or keys. Stream titles that
offer any of those are dropped. Player embeds only, no captures of the game in this repo.
