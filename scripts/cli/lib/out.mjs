// One place for text, color and the JSON envelope. stdout carries the answer; stderr carries noise.
const CODES = { red: 31, green: 32, yellow: 33, dim: 2, bold: 1 };

export function makeOutput({ json = false, quiet = false, color = false } = {}) {
  const paint = (code, text) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const warnings = [];
  const changes = [];

  return {
    json,
    quiet,
    warnings,
    changes,
    paint,
    line: (text = '') => {
      if (!json && !quiet) process.stdout.write(`${text}\n`);
    },
    raw: (text) => {
      process.stdout.write(text);
    },
    warn: (message) => {
      warnings.push(message);
      if (!json) process.stderr.write(`${paint(CODES.yellow, 'warning:')} ${message}\n`);
    },
    note: (message) => {
      if (!json) process.stderr.write(`${paint(CODES.dim, message)}\n`);
    },
    table: (rows, headers) => {
      if (json) return;
      const all = [headers, ...rows].map((r) => r.map(String));
      const width = headers.map((_, i) => Math.max(...all.map((r) => r[i].length)));
      const render = (r, head) =>
        r
          .map((cell, i) => {
            const padded = cell.padEnd(width[i]);
            return head ? paint(CODES.bold, padded) : padded;
          })
          .join('  ')
          .trimEnd();
      if (!quiet) {
        process.stdout.write(`${render(all[0], true)}\n`);
        for (const row of all.slice(1)) process.stdout.write(`${render(row, false)}\n`);
      }
    },
  };
}
