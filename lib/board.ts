import { withoutHidden } from "@/lib/hide"
import type { Milestone } from "@/lib/milestones"
import { getProjects, INACTIVE_DAYS, type Project } from "@/lib/standings"
import {
  getActivity,
  getEvidence,
  getMilestones,
  getRecords,
  getStandings,
  getTracker,
  type Tracker,
} from "@/lib/tracker"

/** A project that joined the board, or left the living part of it. */
export type BoardEvent = {
  id: string
  kind: "joined" | "down" | "inactive"
  projectId: string
  name: string
  /** A day, or a moment when one is known. */
  at: string
  title: string
  detail: string
}

const DAY = 864e5
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const JOINS = /\bjoins\b|\badded to the (?:race|watchlist)\b/

const startsWith = (p: { name: string; id: string }) =>
  new RegExp(`^(?:${[p.name, p.id].map(literal).join("|")})(?![\\w-])`, "i")

type Records = Pick<Tracker, "efforts" | "changes">

/** The change that announced it, matched on how such entries start. Only its date is used. */
function joinedOn(p: Project, { changes }: Records, milestones: Milestone[]) {
  const starts = startsWith(p)
  const dates = [
    ...changes
      .filter((c) => c.kind === "new" && starts.test(c.text) && JOINS.test(c.text))
      .map((c) => c.date),
    ...milestones.filter((m) => m.id === p.id && m.debut).map((m) => m.at),
  ].filter((d) => Number.isFinite(Date.parse(d)))
  return dates.sort((a, b) => Date.parse(a) - Date.parse(b)).at(0) ?? null
}

function wentDown(p: Project, records: Records): { at: string; detail: string } | null {
  const nuked = records.efforts.find((e) => e.id === p.id)?.nuked
  if (nuked) return { at: nuked.at, detail: withoutHidden(nuked.note) }
  // Not reachable isn't proof of a shutdown, so it only says what GitHub answered.
  const gone = new RegExp(`^${literal(p.name)} is no longer reachable`)
  const at = records.changes.findLast((c) => c.kind === "removed" && gone.test(c.text))?.date
  return at ? { at, detail: `${p.reason ?? "Its repo is not reachable"}.` } : null
}

const joinDetail = (p: Project) =>
  `${p.isPrivate ? "A private build, so it isn’t ranked yet" : "Its code is public"}. It claims “${p.stage}” at ${p.score}% and scores ${p.rating}% here.`

/** Newest first. An event needs a date on record: without one it isn't announced. */
export function getBoardEvents(
  projects: Project[],
  records: Records,
  milestones: Milestone[]
): BoardEvent[] {
  const events = projects.flatMap((p): BoardEvent[] => {
    const list: BoardEvent[] = []
    const add = (kind: BoardEvent["kind"], at: string, title: string, detail: string) =>
      list.push({ id: `${kind}:${p.id}`, kind, projectId: p.id, name: p.name, at, title, detail })
    const joined = joinedOn(p, records, milestones)
    if (joined) add("joined", joined, `${p.name} joined the board`, joinDetail(p))
    if (p.status === "offline") {
      const down = wentDown(p, records)
      if (down) add("down", down.at, `${p.name} is down`, down.detail)
    }
    if (p.status === "inactive" && p.lastCode) {
      const at = new Date(Date.parse(p.lastCode.at) + INACTIVE_DAYS * DAY).toISOString()
      add("inactive", at, `${p.name} went inactive`, `${p.reason}.`)
    }
    return list
  })
  // Entries are appended, so on the same day the later one is the newer one.
  // A later change to the same project, such as a new score, doesn't make it newer.
  const order = (e: BoardEvent) => {
    const starts = startsWith({ name: e.name, id: e.projectId })
    return records.changes.findIndex(
      (c) => starts.test(c.text) && (e.kind === "joined" ? JOINS.test(c.text) : c.kind !== "new")
    )
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || order(b) - order(a))
}

/** Within so many days of now, counting a bare date as all of that day. */
export const isRecent = (e: BoardEvent, days: number, now: number) =>
  now - Date.parse(e.at) < days * DAY

export async function getBoard(): Promise<BoardEvent[]> {
  const [tracker, records, evidence, activity, milestones] = await Promise.all([
    getTracker(),
    getRecords(),
    getEvidence(),
    getActivity(),
    getMilestones(),
  ])
  const projects = getProjects(getStandings(tracker, evidence), {
    tracker: records,
    activity,
    milestones,
    evidence,
  })
  return getBoardEvents(projects, records, milestones)
}
