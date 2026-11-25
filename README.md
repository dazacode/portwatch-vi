# VIPortLive

Shows who is streaming work on running GTA VI on PC, and how far each project has got. A fork of
[PortWatch VI](https://github.com/4lwayz/portwatch-vi) by 4lwayz with a new front end (Next.js,
shadcn/ui on Base UI, Tailwind) and live stream tracking. The scout and scoring come from upstream.

    pnpm install
    pnpm dev

| Command                                      | What it does                                               |
| -------------------------------------------- | ---------------------------------------------------------- |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | Checks, also run in CI                                     |
| `pnpm scout:dry`                             | Runs the project scout without saving (set `GITHUB_TOKEN`) |
| `pnpm harvest:dry`                           | Runs the news/commit/PR harvester without saving           |
| `pnpm channels:dry`                          | Shows which stream channels would be added or dropped      |

## Where things are

- `lib/live/`: one file per platform, the title filter, and the snapshot that joins them
- `data/channels.json`: channels being followed. Entries with `"addedBy": "manual"` are yours; the
  `"readme"` ones are managed by `scripts/channels.mjs`
- `data/news.json`: every scraped story, headline and discussion, newest first
- `data/activity.json`: public commits, pull requests and newly found repositories per project
- `data/tracker.json`: projects, scores and headlines, rewritten by `scripts/scout.mjs`
- `lib/scoring.mjs`: the scoring rules, shared by the site and the scout

How the automation works, and why, is in [docs/AUTOMATION.md](docs/AUTOMATION.md).

## Deploy

1. Import the repo in Vercel. The defaults work.
2. Add the keys from `.env.example` that you have.
3. In GitHub, open the Actions tab and enable workflows. GitHub turns them off in forks.

## Rules

Never link to, name or describe ways to get game files, executables or keys. Stream titles that
offer any of those are dropped. Player embeds only, no captures of the game in this repo.
