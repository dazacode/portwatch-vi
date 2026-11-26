# The intelligence desk

How the queue works, and what an agent or a person may do to it. The rules behind the labels are in
[INTELLIGENCE.md](INTELLIGENCE.md).

## The record

`data/intel.json` is the queue and the archive. `./pw intel` is the only writer, and every state change
leaves a reason, an actor and a time in `revisions`. A published report keeps its item and its sources
even after a retraction.

Never edit a published sentence in place. Add a revision. Never delete an item. Retract it.

## Reading the queue

```sh
./pw intel queue --json
./pw intel show <id> --json
```

`queue` returns held items with `heldReasons`. `show` also runs a shallow link check. Read the primary
source before deciding anything: it is the first source, or the one marked `primary`.

Reasons mean:

| Reason                                   | What would clear it                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `low confidence`                         | a second independent source, added with `source`                       |
| `sources disagree`                       | a source that settles which reading is right, then publish with a note |
| `duplicate build reference`              | check the `similar` ids; publish only if it really is its own build    |
| `a claim about the executable or a leak` | check the executable's own status; the bar is higher                   |
| `its source has an open gap`             | wait for the next run, or add the source by hand                       |
| `a rate cap`                             | wait; caps clear themselves                                            |
| `no source`                              | add one                                                                |

## Adding a source

```sh
./pw intel source <id> --url https://… --outlet "Outfit" --title "…" --excerpt "the sentence" --by claude
```

- `https` only, one URL per call.
- The excerpt is the sentence that supports the item. Keep it under 500 characters and do not rewrite it.
- Use `--kind` only through `repair` (`./pw intel repair <id> --url …`), which marks a moved or better
  primary link.
- Adding a source recomputes confidence. It does not publish by itself.

## Publishing

```sh
./pw intel publish <id> --note "two independent testers, checked" --by claude
```

The command builds the four sections from the item and runs the same checks as `./pw check`. It refuses
when a section has a number that is not in a source. Publish only when the primary source plainly says
the one line, and add the reason in `--note`.

Do not publish:

- a social post alone, unless a repo, commit or challenge is behind it;
- a duplicate of a tracked build;
- a takedown without a primary link;
- anything that calls a build authentic. The score stays the editor's.

## Retracting or holding

```sh
./pw intel retract <id> --reason "the clip was another build" --by claude
./pw intel hold <id> --reason "waiting for the second tester"
```

Retraction is public and permanent (the record keeps it). Holding is quiet.

## Auditing

```sh
./pw intel audit --json        # list the findings of past audit passes
./pw intel verify              # the hash chain
node scripts/intel-audit.mjs   # run the audit now
```

The audit may demote or retract on its own; it never republishes. A link that moved is repaired in place
with a revision. Text that no longer supports the report goes back to `held`; a rewrite is a new
publish, not a silent edit.

## Caps

Three reports a run, eight a day, one per project per six hours. A cap holds, never drops. If the queue
is over fifty, `./pw check` warns.

## Finishing

```sh
./pw check --json
```

Exit 0 before you commit. `meta.saved` must be true for a write. Commit only `data/intel.json` unless the
task also changed other data. Use the editor identity, never a personal one.

Summarise at the end: what you published, what you held and why, and anything the owner should look at.
