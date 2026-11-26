import localIntel from "@/data/intel.json"
import { loadData } from "@/lib/data"
import { isHidden } from "@/lib/hide"
import { BUCKET_LABEL, type KINDS, type STATUSES } from "@/lib/intel-gate.mjs"

export type IntelSource = {
  url: string
  host: string
  outlet: string
  title: string
  at: string
  kind: "primary" | "outside" | "official" | "repost"
  authorHash?: string | null
  excerpt?: string
}

export type IntelConfidence = {
  bucket: "low" | "moderate" | "high"
  score: number
  reasons: string[]
  conflict: boolean
}

export type IntelAudit = { kind: string; at: string; by: string; detail: string }

export type IntelRevision = { at: string; by: string; note: string }

export type IntelItem = {
  id: string
  key?: string
  kind: (typeof KINDS)[number]
  projectId: string | null
  projectName: string | null
  at: string
  detectedAt: string
  title: string
  oneLine: string
  sources: IntelSource[]
  fingerprint: {
    repo?: string | null
    name?: string
    words?: string[]
    hash: string
    projectId?: string | null
  }
  similar: { effortId: string; score: number }[]
  confidence: IntelConfidence
  status: (typeof STATUSES)[number]
  sensitive?: boolean
  heldReasons?: string[]
  publishedAt?: string
  deskAt?: string
  note?: string
  audit: IntelAudit | null
  chain: string
  reportId: string | null
  discordAt: string | null
  revisions: IntelRevision[]
}

export type IntelReport = {
  id: string
  itemId: string
  publishedAt: string
  updatedAt?: string
  by: "claude" | "free" | "rules" | "owner" | "desk"
  confidence: string
  overview: string
  changed: string
  evidence: string
  unknown: string
  sources: IntelSource[]
}

export type IntelFile = {
  updated: string | null
  baselineAt: string | null
  coverage: Record<
    string,
    { lastCursor: string; lastOkAt: string; seen: number; events: number; errors: number }
  >
  items: IntelItem[]
  reports: IntelReport[]
}

export const getIntel = async (): Promise<IntelFile> => {
  const file = await loadData<IntelFile>("intel.json", localIntel as IntelFile)
  return {
    ...file,
    items: file.items.filter((i) => !isHidden(i)),
    reports: file.reports.filter((r) => !isHidden(r)),
  }
}

export const byNewest = (a: { at: string }, b: { at: string }) =>
  Date.parse(b.at) - Date.parse(a.at)

/** What a visitor sees: published reports, and held items behind a clear label. */
export const isPublic = (item: IntelItem) =>
  item.status === "published" || item.status === "held" || item.status === "retracted"

export const isVisible = (item: IntelItem) =>
  item.status !== "observed" && !item.kind.match(/^ingest-gap$/)

export const published = (file: IntelFile) =>
  file.items.filter((i) => i.status === "published").sort(byNewest)

export const queue = (file: IntelFile) =>
  file.items.filter((i) => i.status === "held").sort(byNewest)

export const reportOf = (file: IntelFile, item: IntelItem) =>
  item.reportId ? (file.reports.find((r) => r.id === item.reportId) ?? null) : null

export const confidenceLabel = (item: IntelItem) =>
  item.status === "retracted"
    ? "Retracted"
    : item.status === "held"
      ? "Under investigation"
      : (BUCKET_LABEL[item.confidence?.bucket] ?? "Unrated")

export const KIND_LABEL: Record<string, string> = {
  reference: "New discovery",
  update: "Build update",
  evidence: "Test evidence",
  claim: "Community claim",
  takedown: "Takedown",
  duplicate: "Possible duplicate",
  audit: "Audit",
  "ingest-gap": "Source gap",
}

export const sourceCount = (item: IntelItem) =>
  new Set(item.sources.map((s) => `${s.host}|${s.authorHash ?? s.outlet}`)).size

export const nextCursor = (items: IntelItem[], limit: number) =>
  items.length > limit ? items[limit].at : null
