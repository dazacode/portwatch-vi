import { stageRank } from '../../../lib/stages.mjs';

const DAY = 86_400_000;

export const pct = (n) => `${Number(n).toFixed(1)}%`;

export const bar = (n, width = 20) => {
  const filled = Math.max(0, Math.min(width, Math.round((Number(n) / 100) * width)));
  return `${'█'.repeat(filled)}${'·'.repeat(width - filled)}`;
};

export function ago(seconds) {
  if (seconds == null) return 'unknown';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < DAY / 1000) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / (DAY / 1000))}d`;
}

export const today = () => new Date().toISOString().slice(0, 10);

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? '')) && Number.isFinite(Date.parse(s));

export const clip = (text, width = 60) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > width ? `${s.slice(0, width - 1)}…` : s;
};

export const words = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean);

export const slug = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

export const show = (value) =>
  value === null || value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value);

export function stageIndex(key) {
  return stageRank(key);
}
