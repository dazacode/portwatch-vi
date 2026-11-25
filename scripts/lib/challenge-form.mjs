/** Reads the fields of a submitted issue form. Unknown or missing fields come back empty. */
export function parseForm(body) {
  const field = (label) => {
    const m = String(body ?? '').replace(/\r/g, '').match(new RegExp(`^### ${label}\\n\\n([^\\n]*)`, 'm'));
    const value = m?.[1].trim() ?? '';
    return value === '_No response_' ? '' : value;
  };
  return { project: field('Project'), code: field('Code').toUpperCase(), build: field('Build'), gpu: field('Graphics card') };
}
