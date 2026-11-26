---
name: portwatch-cli
description: Change the VIPortLive editorial data with `./pw` — re-score a project, add a finding or article, review candidates, or check the overrides. Use whenever a task touches data/overrides.json or edits claims, scores, findings or news.
---

# Use the project CLI

The repo has an agent-first CLI, `./pw`. Read `docs/CLI.md` in full before the first write.

## Non-negotiables

- `data/tracker.json` is upstream's. Never write it.
- Write only through `./pw`; it patches `data/overrides.json` safely.
- `--dry-run` first, then repeat without it. `--json` always; branch on `ok`, `error.code`,
  `meta.saved`.
- Cite evidence: `find` needs `--url`, `news add` needs `--source` (`https`).
- `./pw check` before committing. Exit 3 is a hard stop.
- Never lower a score on judgement alone (EDITOR.md, hard rule 6).

## Pattern

```sh
./pw show <id> --json
./pw score <id> --set gta.fps=3 --json
./pw set <id> gta.fps=3 --dry-run --json
./pw set <id> gta.fps=3 --change "…" --json
./pw check --json
```

`story` steps: 0, 0.1, 0.25, 0.4, 0.6, 0.85, 1. `render` steps: 0, 0.25, 0.5, 0.75, 1.
Ladder values: 0, 0.5, 1.

## Recovery

- `conflict` (exit 3): read upstream, then repeat with `--rebase` only if our value is still right.
- `locked` (exit 4): wait, or remove `data/.pw/lock` when no other writer runs.
- Backups of every write sit in `data/.pw/backups/`; copy one back to undo.
- `check_failed`: fix each `error`; warnings are judgement calls.
