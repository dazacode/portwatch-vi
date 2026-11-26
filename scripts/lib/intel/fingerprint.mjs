// Build fingerprints. A project's identity, its README and the names it credits are reduced to a
// 64-bit simhash, so a renamed or copied build can be spotted without storing its text.
import { createHash } from 'node:crypto'

const STOP = new Set(
  `a an and are as at be been but by can for from has have how in into is it its of on or that the their then there these they this to was were will with without you your`.split(
    ' '
  )
)

const clean = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[*_`>#|]/g, ' ')
    .replace(/[^a-z0-9+.#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Words and word pairs. Version-like tokens are kept because builds name themselves after them. */
export function features(text) {
  const words = clean(text)
    .split(' ')
    .filter((w) => w.length >= 3 && w.length <= 40 && !STOP.has(w))
  const out = new Set(words)
  for (let i = 0; i < words.length - 1; i++) out.add(`${words[i]} ${words[i + 1]}`)
  return [...out].slice(0, 400)
}

const bit = (feature) => {
  const hash = createHash('sha256').update(feature).digest()
  return hash.readBigUInt64BE(0)
}

/** A 16-character hex simhash. Empty text hashes to zero. */
export function simhash(list) {
  const counts = new Array(64).fill(0)
  for (const feature of list) {
    const h = bit(feature)
    for (let i = 0; i < 64; i++) {
      counts[i] += (h >> BigInt(i)) & 1n ? 1 : -1
    }
  }
  let out = 0n
  for (let i = 0; i < 64; i++) if (counts[i] > 0) out |= 1n << BigInt(i)
  return out.toString(16).padStart(16, '0')
}

export const hamming = (a, b) => {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`)
  let n = 0
  while (x) {
    n += Number(x & 1n)
    x >>= 1n
  }
  return n
}

/** One build's reference. The repo and name are exact-match shortcuts. @param {{repo?: string|null, name?: string, id?: string, summary?: string, readme?: string, credits?: string[]}} input */
export function fingerprintOf({ repo = null, name = '', id = '', summary = '', readme = '', credits = [] }) {
  const identity = clean(`${repo ?? ''} ${name} ${id}`)
  const list = features(`${identity} ${summary} ${credits.join(' ')} ${readme.slice(0, 3000)}`)
  return {
    repo: repo ? repo.toLowerCase() : null,
    name: clean(name),
    words: [...new Set(clean(`${name} ${id}`).split(' ').filter(Boolean))],
    hash: simhash(list),
  }
}

/** 0 to 1. A shared repo is the same build; a shared name and a close hash are strong too. @param {any} a @param {any} b */
export function similarity(a, b) {
  if (a.repo && b.repo && a.repo === b.repo) return 1
  const shared = (a.words ?? []).filter((w) => (b.words ?? []).includes(w))
  const nameScore = shared.length / Math.max(1, Math.min((a.words ?? []).length, (b.words ?? []).length))
  const hashScore = 1 - hamming(a.hash, b.hash) / 64
  return Math.round(Math.max(hashScore, (hashScore + nameScore) / 2) * 100) / 100
}

export const DUPLICATE_AT = 0.78
export const SAME_BUILD_AT = 0.9
