// Confidence, publication and chain rules for the intelligence ledger. Pure: no files, no network.
// The site, the CLI and the tests all read them from here, so a label can never disagree with a gate.

export const KINDS = [
  "reference",
  "update",
  "evidence",
  "claim",
  "takedown",
  "duplicate",
  "ingest-gap",
  "audit",
]
export const STATUSES = ["observed", "held", "published", "retracted"]
export const BUCKETS = ["low", "moderate", "high"]

/** What one source is worth. A project's own repo is primary, but not independent. */
export const WEIGHTS = { primary: 0.3, outside: 0.35, official: 0.5 }
const FRESH_DAYS = 7
const RANK = { low: 0, moderate: 1, high: 2 }

export const BUCKET_LABEL = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
}

/** Everything before this is history, not news. */
export const HOUR = 36e5

export const compact = (iso) =>
  iso
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "z")
    .toLowerCase()

export const sourceKey = (source) =>
  `${source.host}|${source.authorHash ?? source.outlet ?? ""}`.toLowerCase()

/** Distinct voices, not distinct URLs. Reposts and the same author count once. @param {any[]} [sources] */
export function independence(sources = []) {
  const voices = new Map()
  for (const source of sources) {
    if (source.kind === "repost") continue
    const key = sourceKey(source)
    const weight = WEIGHTS[source.kind] ?? WEIGHTS.outside
    voices.set(key, Math.max(voices.get(key) ?? 0, weight))
  }
  return [...voices.values()]
}

/** How sure the record is, before any model looks at it. @param {{sources?: any[], conflict?: boolean, corroborated?: boolean, now?: number, baselineAt?: string|null}} input */
export function assess({
  sources = [],
  conflict = false,
  corroborated = false,
  now = Date.now(),
  baselineAt = null,
}) {
  const fresh = sources.filter((s) => {
    const at = Date.parse(s.at ?? "")
    return !Number.isFinite(at) || now - at < FRESH_DAYS * 24 * HOUR
  })
  const weights = independence(fresh)
  const score = 1 - weights.reduce((left, w) => left * (1 - w), 0)
  const outside = fresh.filter((s) => s.kind !== "primary" && s.kind !== "repost")
  const primary = fresh.some((s) => s.kind === "primary")
  const reasons = []
  if (primary) reasons.push("the project’s own repository")
  if (outside.length)
    reasons.push(`${outside.length} outside source${outside.length === 1 ? "" : "s"}`)
  if (conflict) reasons.push("sources disagree")
  if (baselineAt && fresh.some((s) => Date.parse(s.at ?? "") < Date.parse(baselineAt))) {
    reasons.push("from before the baseline")
  }

  let bucket = "low"
  if (!conflict && primary && outside.length >= 3) bucket = "high"
  else if (!conflict && (outside.length >= 2 || (primary && outside.length >= 1)))
    bucket = "moderate"
  else if (!conflict && corroborated) {
    bucket = "moderate"
    reasons.push("a record the pipeline already read")
  }

  return { bucket, score: Math.round(score * 100) / 100, reasons, conflict: Boolean(conflict) }
}

/** The gate. `held` is a decision, not a failure; every reason is written down. */
/** @param {any} item @param {{openGap?: boolean, duplicate?: boolean}} [options] */
export function gate(item, { openGap = false, duplicate = false } = {}) {
  const reasons = []
  if (!item.sources?.length) reasons.push("no source")
  if (item.sources?.some((s) => !/^https:\/\//.test(s.url ?? "")))
    reasons.push("a source is not https")
  if (item.confidence?.conflict) reasons.push("sources disagree")
  if (item.kind === "duplicate" || duplicate) reasons.push("duplicate build reference")
  if (openGap) reasons.push("its source has an open gap")
  if (item.kind === "claim" && item.sensitive)
    reasons.push("a claim about the executable or a leak")
  if ((item.confidence?.bucket ?? "low") === "low") reasons.push("low confidence")

  return reasons.length ? { status: "held", reasons } : { status: "published", reasons }
}

/** The audit can only make an item more cautious, never freer. */
export function auditOutcome(finding) {
  switch (finding) {
    case "dead-link":
      return { status: null, note: "source link no longer answers" }
    case "moved":
      return { status: null, note: "source moved; link updated" }
    case "unsupported":
      return { status: "held", note: "the source no longer supports the report" }
    case "contradicted":
      return { status: "retracted", note: "a stronger source contradicts the report" }
    case "confidence-drop":
      return { status: "held", note: "confidence fell below its bucket" }
    default:
      return { status: null, note: "audit finding" }
  }
}

/** Two reports describe the same event when kind, project and a half-day agree. */
export function eventKey({ kind, projectId, keyText = "", url = "", at }) {
  const bucket = Math.floor(Date.parse(at) / (12 * HOUR))
  return `${kind}|${projectId ?? "-"}|${(keyText || url).toLowerCase()}|${bucket}`
}

export function bucketAtLeast(bucket, floor) {
  return (RANK[bucket] ?? 0) >= (RANK[floor] ?? 0)
}

/** A link from an item to the one before it, so a lost or rewritten row shows. */
export const chainOf = (prev, item) =>
  `${prev ?? "genesis"}|${item.id}|${item.at}|${item.fingerprint ?? ""}`
