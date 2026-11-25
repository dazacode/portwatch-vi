const UNIT = { K: 1e3, M: 1e6 } as const

/** "4.6K watching" to 4600. Null when the text has no viewer count. */
export function parseWatching(text: string | undefined) {
  const match = text?.match(/([\d.,]+)\s*([KM])?\s+watching/i)
  if (!match) return null
  const n = Number(match[1].replace(/,/g, ""))
  const unit = match[2]?.toUpperCase() as keyof typeof UNIT | undefined
  return Number.isFinite(n) ? Math.round(n * (unit ? UNIT[unit] : 1)) : null
}
