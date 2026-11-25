# The editor CLI

`./pw` is the only safe way for a person or an agent to change the editorial data. It knows which
file a value belongs in, validates it, previews the score, and writes atomically. Hand-editing JSON is
still possible, but the CLI is faster and refuses mistakes a text editor won't.

- `data/tracker.json` is upstream's. Read it, never write it; the sync replaces it whole.
- Everything we decide goes in `data/overrides.json`: patches, added projects, articles, ignored
  candidates and the pick.
- A write is a patch: the value upstream had in `from`, ours in `to`. If upstream changes that value
  first, the patch lapses and `set` refuses to guess.

Read [EDITOR.md](../EDITOR.md) for the editorial rules and [docs/AUTOMATION.md](AUTOMATION.md) for how
the data reaches the site. The CLI enforces shapes, not judgement.

## Rules an agent must follow

1. **Dry run first** for anything that writes. Read the output, then repeat without `--dry-run`.
2. **Use `--json`** and branch on fields. Do not scrape the human output.
3. **Cite the source.** `find` needs `--url`; `news add` needs `--source`. An unsourced finding is a
   rumour.
4. **Never invent values.** Read the project's README, commits or a reputable outlet first.
   `story` and `render` use the written steps exactly; use `score --set` to see the result before
   saving.
5. **Run `./pw check` before committing.** It exits 3 on any error.
6. **Never commit `data/tracker.json`**, and never run `saveOverrides` by hand.
7. **Stop on a conflict.** Read `error.data.moved`, check upstream, then use `--rebase` only when
   our value is still right.
8. **Don't lower a value on judgement alone.** Put the suggested cut in the change line or summary
   (EDITOR.md, hard rule 6).

## Run it

```sh
./pw help
./pw status
./pw list --query zettrox
./pw show zettrox
```

Aliases: `projects` = `list`, `project` = `show`, `article` = `news`, `candidates` = `candidate`.

Global flags: `--json`, `--dry-run`, `--data <dir>`, `--root <dir>`, `--no-color`, `--quiet`.

`pnpm pw` works too, but pnpm prints a banner on stdout first. Machine calls should use `./pw`, or
`pnpm --silent pw`, so stdout is only the JSON envelope. `./pw` needs a POSIX shell; on Windows use
`pnpm --silent pw`.
Exit codes: `0` ok, `2` usage or invalid, `3` conflict or failed check, `4` locked, `5` internal.

## Machine contract

`--json` prints exactly one object and nothing else on stdout. Logs and warnings stay on stderr (and
in `warnings`).

```json
{
  "ok": true,
  "command": "set",
  "data": { "project": "zettrox", "changes": [{ "path": "gta.fps", "from": 2, "to": 2.5 }] },
  "warnings": [],
  "meta": {
    "version": "0.1.0",
    "dataDir": "/repo/data",
    "dryRun": false,
    "saved": true,
    "changes": []
  }
}
```

On failure `ok` is false and `error` carries `code`, `message`, `hint` and sometimes `data`:

```json
{
  "ok": false,
  "error": { "code": "ambiguous_project", "message": "…", "data": { "candidates": [] } }
}
```

Codes you must handle: `usage`, `invalid`, `not_found`, `ambiguous_project`, `conflict`, `locked`,
`bad_json`, `bad_tracker`, `bad_overrides`, `check_failed`.

## Reading

| Command                                                                                                                      | What it gives                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `status`                                                                                                                     | counts, tracker age, lapsed patches, leader                    |
| `list [--query t] [--stage k] [--code all\|public\|private] [--sort rank\|rating\|claimed\|stars\|name] [--limit n] [--all]` | one row per project with `id`, both scores and rank            |
| `show <id>`                                                                                                                  | values, our patch vs upstream, score parts, findings, evidence |
| `score <id> [--set k=v]...`                                                                                                  | the arithmetic, optionally for unsaved values                  |
| `diff`                                                                                                                       | every override, and which patches lapsed                       |
| `fields`                                                                                                                     | editable field names and allowed values                        |
| `schema [kind]`                                                                                                              | the same rules as machine-readable JSON                        |
| `check`                                                                                                                      | shape, value, article and patch validation                     |
| `doctor`                                                                                                                     | node, data directory, git identity, tracker age                |

Ids resolve exactly, then by repo, then by name, then by one unique substring. An ambiguous query
returns all candidates rather than guessing.

## Re-score a project

```sh
./pw show zettrox
./pw score zettrox --set gta.fps=2.5          # preview, nothing written
./pw set zettrox gta.fps=2.5 --dry-run        # preview with the assessed fields
./pw set zettrox gta.fps=2.5 --change "…"     # save
./pw check
./pw diff
```

`set` accepts `field=value` pairs. It writes `assessedAt` (today) and `assessedBy` (`claude` by
default) unless `--no-assessed`. If the claimed score moves by 0.5 or more, or a milestone changes,
it adds a `changes` line automatically; `--change "text"` overrides the wording and `--kind` picks
`up`, `down` or `new`.

Values:

- `gta.loads`, `boots`, `menu`, `world`, `playable`: `0`, `0.5` or `1`
- `gta.story`: `0`, `0.1`, `0.25`, `0.4`, `0.6`, `0.85`, `1`
- `gta.render`: `0`, `0.25`, `0.5`, `0.75`, `1`
- `gta.fps`: a number from 0 to 240
- `goalProof.fps`, `goalProof.render`, `goalProof.story`: an `https` link, or `null` (see Goals below)
- `gta.stability`: `unknown`, `constant`, `often`, `sometimes`, `rarely`, `stable`, or a number 0–1
- `summary`, `highlights` (max 3), `blockers` (max 3): JSON arrays for the lists
- `verification`: `self-reported` or `reproduced`
- `manualScore`: a number or `null`, only for an owner's hand call
- `tier`: `tracked` or `watchlist`

An added project also takes `repo`, `branch`, `basedOn`, `related`, `evidence`, `publicLater`,
`avatar`, `byline`, `approach`, `target`, `nuked`, `stats`, `name` and `id`. `stats`, `id`, `repo`
and `branch` are upstream-owned on a tracked project and cannot be patched.

## Goals: Playable and Story beaten

Upstream's `playable` stage shows as **Runnable** on our site: a character can be moved, at any speed.
The key and the points stay upstream's. Two goals of ours come after it (`lib/stages.mjs`):

| Goal                    | Needs                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Playable (`smooth`)     | `gta.fps` 20 or more and `gta.render` 0.75 or more, with `goalProof.fps` and `goalProof.render` |
| Story beaten (`beaten`) | the same, and `gta.story` 0.85 or more with `goalProof.story`                                   |

A goal adds no points. It is reached only with a link for everything it needs: a recording that shows
it, or a report by someone outside the project. A README saying so isn't evidence. `show` lists what is
missing.

```sh
./pw set zettrox gta.fps=24 gta.render=0.75 goalProof.fps=https://… goalProof.render=https://… --dry-run
```

## Findings

```sh
./pw find zettrox --text "The boat reaches the bridge." --url https://… --source "From onyx's post of 25 Nov."
./pw find zettrox --index 2 --text "Corrected wording." --url https://…
./pw find zettrox --remove --index 4
./pw find zettrox --clear
```

`--url` must be `https`. The source note is optional but encouraged; `--clear-source` removes it.
Duplicate text is refused.

## Articles

```sh
./pw news list
./pw news show 2026-11-25-zettrox-no-crashes
./pw news add \
  --title "…" --dek "…" --category Port \
  --body "paragraph one" --body "paragraph two" --body "paragraph three" \
  --source "GitHub|the repo|https://github.com/owner/repo"
./pw news set <id> title="…"
./pw news rm <id>
```

Categories: `Leak`, `Takedown`, `Legal`, `Security`, `Official`, `Port`, `Safety`.
`--by` is `claude` (default), `report` or `owner`. Body: 2–5 paragraphs, 120–220 words in total.
An `--id` may be given; otherwise it is `<date>-<slug of title>` and can never be reused.

Upstream articles can be edited or removed. Editing keeps the id and shadows the upstream copy;
removal is recorded in `removedNews`, so it survives the next sync. Default `image` is `null`; use
`--image <url> --credit <outlet> --link <page>` for a source's `og:image`. A leaked-game or Discord
screenshot still belongs in no article image.

## Candidates

```sh
./pw candidate list --kind effort
./pw candidate show owner/repo
./pw candidate ignore owner/repo --reason "copy of owner/other"
./pw candidate unignore owner/repo
./pw candidate track owner/repo --file effort.json
```

`ignore` also removes it from the visible inbox by recording it in `decided`. `track` promotes it:
the file holds an effort object (`id`, `name`, `summary`, `blockers`, `gta`, …) and the candidate's
stats are copied in. See `./pw fields` and `show` an existing project for the shape.

## Pick

```sh
./pw pick set cgbj --reason "Closest picture to the console; not ranked because the code is private."
./pw pick clear
./pw pick show
```

The pick is only a placement. It never changes a score.

## Conflicts, locks and backups

A patch's `from` must still be what upstream says. If it isn't, `set` exits 3 with `error.data.moved`.
Read upstream first; if our value still applies, repeat with `--rebase` to move `from` onto the
current value. Without `--rebase`, nothing is written. `find` takes `--rebase` too. When several
fields lapsed and all our values still stand, `./pw rebase <id> --dry-run` then
`./pw rebase <id>` moves the whole patch without re-entering values.

Only one writer runs at a time (`data/.pw/lock`). A lock older than 60 seconds is taken over. Every
write saves the previous file to `data/.pw/backups/` (last 10, git-ignored); copy one back with
`cp` if a write needs undoing. Nothing but `data/overrides.json` is written.

## Publish

The CLI never commits or pushes. The site reads `data/overrides.json` from `main`, so a commit of that
file alone needs no deploy. GitHub tells the site, and the next visit shows it.

```sh
git pull                                  # the site reads upstream live, so start from the newest copy
./pw set zettrox gta.fps=2.5
./pw check
git commit data/overrides.json -m "…"
git push origin HEAD:main
```

The scout also writes this file. If the push is refused, `git pull --rebase`, run `./pw check` and push
again. Vercel builds whenever anything outside `data/` changed since its last deploy.

## Troubleshooting

| Symptom         | Do                                                        |
| --------------- | --------------------------------------------------------- |
| `bad_tracker`   | restore `data/tracker.json` from git or wait for the sync |
| `bad_overrides` | `git checkout data/overrides.json` or fix the shape       |
| `conflict`      | read upstream, then `--rebase` or reword the patch        |
| `locked`        | wait, or delete `data/.pw/lock` when nothing is running   |
| `check_failed`  | fix every listed `error`; warnings are judgement calls    |
| `internal`      | run `./pw doctor`, then `pnpm test`                       |

Tests for the CLI are in `tests/cli.test.ts` and `tests/cli-overrides.test.ts`; both run against a
temporary data directory, so they never touch the real files.
