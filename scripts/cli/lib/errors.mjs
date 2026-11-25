// Errors an agent can act on: a stable code, a plain message and an optional hint.
export class CliError extends Error {
  constructor(code, message, { hint = null, data = null, exit = 2 } = {}) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.hint = hint;
    this.data = data;
    this.exit = exit;
  }
}

export const usage = (message, hint) =>
  new CliError('usage', message, { hint, exit: 2 });

export const invalid = (message, hint, data) =>
  new CliError('invalid', message, { hint, data, exit: 2 });

export const conflict = (message, hint, data) =>
  new CliError('conflict', message, { hint, data, exit: 3 });

export const notFound = (message, hint, data) =>
  new CliError('not_found', message, { hint, data, exit: 2 });

export const ambiguous = (query, candidates) =>
  new CliError('ambiguous_project', `"${query}" matches more than one project.`, {
    hint: 'Use the exact id (the first column of `./pw list`).',
    data: { candidates },
    exit: 2,
  });

export const internal = (message, data) =>
  new CliError('internal', message, { data, exit: 5 });
