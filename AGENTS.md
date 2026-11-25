<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Changing project data: use `./pw`

The editorial data has its own CLI. Use it instead of editing JSON by hand, and read
[docs/CLI.md](docs/CLI.md) before the first write (fields, JSON envelopes, exit codes, recovery).

- `data/tracker.json` is upstream's copy. Never write it.
- Every decision goes to `data/overrides.json`, through `./pw`.
- Start writes with `--dry-run`; use `--json` and branch on `ok`, `error.code` and `meta.saved`.
- `find` and `news add` need an `https` source. `story` and `render` take written step values only.
- Run `./pw check` before committing. Exit 3 means fix the errors.
- On `conflict`, read upstream and repeat with `--rebase` only if our value is still right.
- Do not lower a score on judgement alone (see `EDITOR.md`, hard rule 6).
