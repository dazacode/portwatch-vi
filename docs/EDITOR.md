# The automated editor

`editor.yml` runs an editorial pass without anyone at the keyboard: sourced findings, re-scores, candidate
reviews, new private builds, a hand placement and at most two articles per day. It exists because the
scout is mechanical and the editor playbook is not, and because the maintainer's Mac is not always awake.

It changes `data/overrides.json` and its own `data/editor.json`, through [`./pw`](CLI.md) only. It never
writes `data/tracker.json`, `data/pinned.json` or a deploy, and it never merges a pull request or replies
to an issue.

## When it runs

The Cloudflare timer starts it every hour at :35 (`timer/worker.mjs`), after the hour's harvest and away
from the sync minutes. `workflow_dispatch` runs it by hand, with **dry_run** to print the plan and keep
nothing. It shares the `data-write` group, so it never pushes beside the scout or a sync.

## Who decides

The rules are [EDITOR.md](../EDITOR.md). A model proposes; the code disposes. `ANTHROPIC_API_KEY` gives the
best judgement. Without it the keyless route is used (`FREE_AI`, then Pollinations and Kilo from
`scripts/lib/free-ai.mjs`); `FREE_AI=off` turns that off. With neither, the run says so and exits without a
write. `EDITOR_MODEL` overrides the Claude model.

The brief is built from what the harvester and the scout already collected — `data/news.json`,
`data/headlines`, `data/dmca`, open claims, moved READMEs, the candidate inbox — plus a short README and
commit digest for projects worth a look. The model returns one JSON plan.

## What is enforced in code

`scripts/lib/editor.mjs` refuses work the playbook would refuse:

- **Only brief URLs.** A finding or article source must be one of the lead ids in the brief, so a model
  cannot invent a link. A finding whose words don't meet its lead is dropped.
- **No silent cuts.** A score that falls is skipped unless the plan sets `withdrawn: true` (hard rule 6).
- **Dry run first, always**, then the real write. A refusal at either step skips the action.
- **Caps:** 12 findings, 6 score changes, 6 candidate decisions, 2 new projects, and articles only up to
  the two-a-day limit. A project stops at 12 findings.
- **Value rules:** every field goes through `./pw`, so the written steps, https links, word limits and
  article shape are the CLI's, not a model's.
- **Check before keep.** `./pw check` runs after the writes. Any error of ours reverts
  `data/overrides.json`; a lapse caused by upstream is reported and kept.
- **Identity.** Commits use `viportlive-editor[bot] <41898282+4lwayz@users.noreply.github.com>`, as hard
  rule 1 asks.

It keeps articles image-free, because a leaked-game or Discord frame cannot be told apart from an
`og:image` automatically. Add an image by hand if it is safe.

## Reviewing a run

```sh
git log --oneline -10 -- data/overrides.json
./pw diff                       # every override and every lapsed patch
./pw status
```

The run summary lists what was applied and what was skipped, with the reason, under **Editor run** in the
Actions job. `data/editor.json` keeps the last 40 runs. To undo one, revert its commit or copy a backup
from `data/.pw/backups/` (git-ignored, last 10) and `git checkout -- data/overrides.json` for the rest.
Then `./pw check`.

A finding is a lead that was read, not a verified result; a score the editor raises is still
`self-reported`. Owner decisions in `EDITOR.md` stand, and the editor must not lower them.

## Turning it off

Delete the `editor.yml` entry from `JOBS` in `timer/worker.mjs` (and deploy the Worker) and disable the
workflow. Nothing else reads `data/editor.json`, so leaving it in place is harmless.
