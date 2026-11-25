import { createHmac } from "node:crypto"

/** Who has the site open right now. Kept in Redis for minutes, and off without one: no store, no number. */
const KEY = "vp:watching"
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const secret =
  process.env.CHALLENGE_SECRET ??
  (process.env.NODE_ENV === "production" ? null : "viportlive-local-only")

export const presenceOn = Boolean(url && token && secret)

/** The pace of check-ins in seconds: slower as the crowd grows, so it stays near one a second. */
export const pace = (count: number) => Math.min(600, Math.max(45, Math.round(count)))

const MAX_READ = 5000
/** A household, or someone with many tabs. */
const MAX_PER_ADDRESS = 5
const LISTED = 100

export type Beat = { id: string; room: string; wait: number; left?: string; gone?: boolean }

const ID = /^[a-z0-9]{10}$/
const ROOM = /^[\w:.@/-]{1,100}$/

/** Null for anything we didn't send ourselves. */
export function parseBeat(body: unknown): Beat | null {
  if (!body || typeof body !== "object") return null
  const { id, room, wait, left, gone } = body as Record<string, unknown>
  if (typeof id !== "string" || !ID.test(id)) return null
  if (typeof room !== "string" || !ROOM.test(room)) return null
  if (left !== undefined && (typeof left !== "string" || !ROOM.test(left))) return null
  return {
    id,
    room,
    wait: pace(typeof wait === "number" && Number.isFinite(wait) ? wait : 0),
    ...(left !== undefined && { left: left as string }),
    ...(gone === true && { gone }),
  }
}

const hash = (text: string, key: string) => createHmac("sha256", key).update(text).digest("hex")

/** Changes every day, and can't be turned back into an address without the secret. */
export const addressTag = (ip: string, key: string, now: number) =>
  hash(`${new Date(now).toISOString().slice(0, 10)}:${ip}`, key).slice(0, 10)

const FIRST = [
  "Neon",
  "Sunset",
  "Coral",
  "Midnight",
  "Palm",
  "Salty",
  "Turbo",
  "Velvet",
  "Lucky",
  "Humid",
  "Golden",
  "Static",
  "Mellow",
  "Rapid",
  "Dusty",
  "Electric",
]
const SECOND = [
  "Pelican",
  "Gator",
  "Manatee",
  "Flamingo",
  "Heron",
  "Marlin",
  "Iguana",
  "Ibis",
  "Otter",
  "Gecko",
  "Tarpon",
  "Osprey",
  "Panther",
  "Conch",
  "Dolphin",
  "Mango",
]

/** A made-up name, so there is nothing to type and nothing to moderate. */
export function nameOf(who: string) {
  const bytes = Buffer.from(hash(who, "name"), "hex")
  return `${FIRST[bytes[0] % FIRST.length]}${SECOND[bytes[1] % SECOND.length]}${bytes[2] % 100}`
}

export type Watching =
  | { on: false }
  | {
      on: true
      total: number
      rooms: Record<string, number>
      watchers: { name: string; room: string }[]
    }

/** Members are "address.id|room". One place each, and only so many for one address. */
export function crowd(members: string[]): Extract<Watching, { on: true }> {
  const seen = new Set<string>()
  const perAddress = new Map<string, number>()
  const rooms: Record<string, number> = Object.create(null)
  const watchers: { name: string; room: string }[] = []
  for (const member of members) {
    const at = member.indexOf("|")
    const who = member.slice(0, at)
    const room = member.slice(at + 1)
    const address = who.split(".")[0]
    const n = perAddress.get(address) ?? 0
    if (at < 0 || seen.has(who) || n >= MAX_PER_ADDRESS) continue
    seen.add(who)
    perAddress.set(address, n + 1)
    rooms[room] = (rooms[room] ?? 0) + 1
    if (watchers.length < LISTED) watchers.push({ name: nameOf(who), room })
  }
  return { on: true, total: seen.size, rooms, watchers }
}

async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`Redis answered ${res.status}`)
  const out = (await res.json()) as { result?: unknown; error?: string }[]
  const failed = out.find((r) => r.error)
  if (failed) throw new Error(failed.error)
  return out.map((r) => r.result)
}

export async function beat(b: Beat, ip: string, now = Date.now()) {
  const who = `${addressTag(ip, secret as string, now)}.${b.id}`
  const commands: (string | number)[][] = []
  if (b.left && b.left !== b.room) commands.push(["ZREM", KEY, `${who}|${b.left}`])
  commands.push(
    b.gone
      ? ["ZREM", KEY, `${who}|${b.room}`]
      : ["ZADD", KEY, now + b.wait * 2200, `${who}|${b.room}`]
  )
  await redis(commands)
  return nameOf(who)
}

export async function watching(now = Date.now()): Promise<Watching> {
  if (!presenceOn) return { on: false }
  // The newest are at the end, and past the limit they are the ones that matter.
  const [, members] = await redis([
    ["ZREMRANGEBYSCORE", KEY, "-inf", now],
    ["ZRANGE", KEY, -MAX_READ, -1],
  ])
  return crowd((members as string[]).reverse())
}
