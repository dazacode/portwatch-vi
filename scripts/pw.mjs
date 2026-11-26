#!/usr/bin/env node
// pw — the editor-side command line. Agent-first: JSON envelopes, dry runs, stable exit codes.
// Not a build tool and not a website command. Docs: docs/CLI.md
import { CliError, usage } from './cli/lib/errors.mjs';
import { bool, parseArgv } from './cli/lib/args.mjs';
import { makeOutput } from './cli/lib/out.mjs';
import { pathsFor, resolveRoot, saveIntel, saveOverrides } from './cli/lib/data.mjs';
import * as read from './cli/commands/read.mjs';
import * as write from './cli/commands/write.mjs';
import * as intel from './cli/commands/intel.mjs';

const VERSION = '0.1.0';
const EXIT = { ok: 0, usage: 2, conflict: 3, locked: 4, internal: 5 };

const COMMANDS = {
  status: read.status,
  list: read.list,
  projects: read.list,
  show: read.show,
  project: read.show,
  score: read.score,
  diff: read.diff,
  check: read.check,
  doctor: read.doctor,
  fields: read.fields,
  schema: read.schema,
  set: write.set,
  rebase: write.rebase,
  added: write.added,
  private: write.added,
  find: write.find,
  pick: write.pick,
  news: write.news,
  article: write.news,
  candidate: write.candidate,
  candidates: write.candidate,
  intel: intel.intel,
};

const HELP = `pw — edit the VIPortLive data safely

  ./pw <command> [arguments] [flags]

  (./pw works too; ./pw keeps stdout clean for --json)

Read
  status              where the data stands
  list                projects with id, stage and scores (alias: projects)
  show <id>           everything about one project (alias: project)
  score <id>          the score arithmetic, with optional --set previews
  diff                everything our overrides change
  check               validate overrides, patches, articles and tracker
  doctor              toolchain, data files and git identity
  fields              editable field names and rules
  schema [kind]       the same rules as JSON

Write (all support --dry-run)
  set <id> k=v...     set claim fields; prints the score delta
  rebase <id>         move a lapsed patch onto upstream's values
  added new <id> ...  add a project only we publish; private builds have repo null
  find <id>           add or edit a sourced finding
  pick set|clear      place a project first by hand
  news add|list|...   articles
  candidate ...       review the inbox, ignore or promote
  intel ...           the intelligence desk: queue, source, publish, retract

Flags
  --json              one JSON envelope on stdout
  --dry-run           show the writes, save nothing
  --data <dir>        data directory (default: ./data)
  --root <dir>        repository root (default: this checkout)
  --no-color          no ANSI color
  --quiet             no human output

Exit codes: 0 ok, 2 usage or invalid, 3 conflict or failed check, 4 locked, 5 internal.
Docs: docs/CLI.md`;

function commandHelp(name, command) {
  const flags = [...(command.value ?? []), ...(command.bool ?? [])].map((f) => `--${f}`);
  return `${name} — ${command.summary}\n\n  ./pw ${name} ${command.usage ?? ''}\n\nFlags: ${flags.length ? flags.join(', ') : 'none'}\nGlobal flags also apply (--json, --dry-run, --data, --root, --no-color, --quiet).`;
}

function preparse(argv) {
  const globals = {};
  let i = 0;
  const value = new Set(['data', 'root']);
  const bools = new Set(['json', 'quiet', 'dry-run', 'force', 'no-color', 'no-assessed', 'help']);
  while (i < argv.length) {
    const arg = argv[i];
    if (!arg.startsWith('--')) break;
    if (arg === '--') break;
    const name = arg.slice(2).split('=')[0];
    if (bools.has(name)) {
      globals[name] = true;
      i++;
      continue;
    }
    if (value.has(name)) {
      const inline = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      if (inline != null) globals[name] = inline;
      i++;
      continue;
    }
    break;
  }
  return { globals, rest: argv.slice(i) };
}

let currentCommand = null;

async function main(argv) {
  const { globals, rest } = preparse(argv);
  const name = rest[0];
  currentCommand = name ?? null;
  const command = name ? COMMANDS[name] : null;
  const args = rest.slice(1);
  const parsed = parseArgv(args, command ?? {});
  const flags = { ...globals, ...parsed.flags };
  const json = Boolean(flags.json);
  const quiet = Boolean(flags.quiet);
  const color = !json && !flags['no-color'] && Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  const out = makeOutput({ json, quiet, color });

  if (!name || name === 'help' || flags.help) {
    const target = name === 'help' ? args[0] : flags.help ? name : null;
    const found = target ? COMMANDS[target] : null;
    const text = found ? commandHelp(target, found) : HELP;
    if (json) {
      out.raw(`${JSON.stringify({ ok: true, command: 'help', data: found ? { help: text } : { commands: Object.keys(COMMANDS), help: text }, warnings: [], meta: { version: VERSION } }, null, 2)}\n`);
      return EXIT.ok;
    }
    out.line(text);
    return EXIT.ok;
  }

  if (!command) throw usage(`Unknown command "${name}".`, 'Run `./pw help`.');

  const root = resolveRoot(flags);
  const paths = pathsFor(root, flags);
  const result = (await command.run({ out, flags, paths, root }, parsed.positional, flags)) ?? {};
  const changes = result.changes ?? [];
  let saved = false;

  if (result.overrides) {
    if (bool(flags, 'dry-run')) out.line(`dry run: ${changes.length} change(s), nothing written`);
    else {
      await saveOverrides(paths, result.overrides);
      saved = true;
      out.line(`saved ${changes.length} change(s) to ${paths.overrides}`);
      out.note(`backup in ${paths.backups}`);
    }
  }
  if (result.intel) {
    if (bool(flags, 'dry-run')) out.line('dry run: intel ledger not written');
    else {
      await saveIntel(paths, result.intel);
      saved = true;
      out.line(`saved the intel ledger to ${paths.intel}`);
    }
  }

  const data = Object.fromEntries(
    Object.entries(result).filter(([key]) => key !== 'overrides' && key !== 'intel')
  );
  if (json) {
    out.raw(
      `${JSON.stringify(
        {
          ok: true,
          command: name,
          data,
          warnings: out.warnings,
          meta: { version: VERSION, dataDir: paths.dataDir, dryRun: Boolean(flags['dry-run']), saved, changes },
        },
        null,
        2
      )}\n`
    );
  }
  return EXIT.ok;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const json = process.argv.includes('--json');
    const known = err instanceof CliError;
    const code = known ? err.exit : (EXIT.internal ?? 5);
    if (!known) {
      process.stderr.write(`internal error: ${err.stack ?? err.message}\n`);
    }
    if (json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: false,
            command: currentCommand,
            error: {
              code: known ? err.code : 'internal',
              message: err.message,
              hint: known ? err.hint : 'Run with the stack above, or `./pw doctor`.',
              ...(known && err.data ? { data: err.data } : {}),
            },
            warnings: [],
            meta: { version: VERSION },
          },
          null,
          2
        )}\n`
      );
    } else {
      process.stderr.write(`error: ${err.message}\n`);
      if (known && err.hint) process.stderr.write(`hint: ${err.hint}\n`);
    }
    process.exit(code);
  });
