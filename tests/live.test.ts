import { describe, expect, it } from "vitest"
import { isBoard, isLure, isPortStream } from "@/lib/live/filter"
import { fromLockup } from "@/lib/live/lockup"
import { parseRumble } from "@/lib/live/rumble"
import { assemble } from "@/lib/live/snapshot"
import type { Channel, SourceResult, Stream } from "@/lib/live/types"
import { parseWatching } from "@/lib/live/watching"

describe("isPortStream", () => {
  it.each([
    "GTA 6 recomp - fixing shadows",
    "GTA VI PC port dev stream",
    "Working on a Grand Theft Auto VI emulator",
    "GTA6 recompilation day 4",
  ])("accepts %s", (title) => expect(isPortStream(title)).toBe(true))

  it.each([
    "GTA VI story mode blind playthrough",
    "Minecraft recomp",
    "GTA 6 PC port FREE DOWNLOAD",
    "GTA VI recomp, link in description",
    "GTA 6 emulator giveaway",
    "GTA 6 recomp discord.gg/abc",
  ])("rejects %s", (title) => expect(isPortStream(title)).toBe(false))

  it("does not read ordinary words as lures", () => {
    expect(isLure("Keyboard input and freeways are working")).toBe(false)
  })
})

const video = (over: object = {}) => ({
  object_type: "video",
  title: "GTA 6 &amp; chill",
  relative_url: "/v7abc-gta.html?e9s=src",
  live: true,
  live_placeholder: false,
  ...over,
})
const page = (...items: object[]) =>
  `<title>someone</title><nav id="main-menu"></nav><rum-videos-grid>
    <script type="application/json">
        ${JSON.stringify({ items })}
    </script></rum-videos-grid>`

describe("parseRumble", () => {
  it("reads the live video and skips finished ones", () => {
    expect(parseRumble(page(video({ live: false, title: "old" }), video()))).toEqual({
      title: "GTA 6 & chill",
      path: "/v7abc-gta.html",
    })
  })
  it("is null when nothing is live", () => {
    expect(parseRumble(page())).toBeNull()
    expect(parseRumble(page(video({ live: false })))).toBeNull()
    expect(parseRumble(page(video({ live_placeholder: true })))).toBeNull()
  })
  it("skips items that aren't videos", () => {
    expect(parseRumble(page({ object_type: "ad" }, video()))?.path).toBe("/v7abc-gta.html")
  })
  it("is undefined when there is no video list, such as a bot challenge or a new layout", () => {
    expect(parseRumble("<html>Just a moment...</html>")).toBeUndefined()
    expect(parseRumble('<title>someone</title><nav id="main-menu"></nav>')).toBeUndefined()
    expect(
      parseRumble('<rum-videos-grid><script type="application/json">{</script></rum-videos-grid>')
    ).toBeUndefined()
  })
})

const channel = (handle: string, platform: Channel["platform"]): Channel => ({
  platform,
  handle,
  name: handle,
  effortId: null,
  addedBy: "manual",
})
const stream = (over: Partial<Stream>): Stream => ({
  id: "x",
  platform: "twitch",
  handle: "a",
  name: "a",
  title: "t",
  url: "u",
  startedAt: null,
  viewers: null,
  effortId: null,
  origin: "search",
  embed: null,
  ...over,
})
const off: SourceResult = { state: "off", streams: [] }

describe("assemble", () => {
  it("reports unknown, not offline, when a platform is off or a channel failed", () => {
    const snap = assemble(
      [channel("a", "twitch"), channel("user/b", "rumble"), channel("user/c", "rumble")],
      {
        twitch: off,
        youtube: off,
        kick: off,
        rumble: { state: "ok", streams: [], unknown: ["user/b"] },
      },
      "2026-11-24T00:00:00Z"
    )
    expect(snap.channels.map((c) => c.live)).toEqual([null, null, false])
  })
  it("puts tracked channels above bigger search results and ignores handle case", () => {
    const snap = assemble(
      [channel("Dev", "twitch")],
      {
        twitch: {
          state: "ok",
          streams: [
            stream({ id: "big", handle: "big", viewers: 9000 }),
            stream({ id: "dev", handle: "dev", viewers: 3, origin: "tracked" }),
          ],
        },
        youtube: off,
        kick: off,
        rumble: off,
      },
      "2026-11-24T00:00:00Z"
    )
    expect(snap.streams.map((s) => s.id)).toEqual(["dev", "big"])
    expect(snap.channels[0].live).toBe(true)
  })
})

describe("isBoard", () => {
  it("separates round-the-clock boards from people working", () => {
    expect(isBoard("GTA 6 PC Port Race LIVE 24/7: VIctory vs XCL")).toBe(true)
    expect(isBoard("GTA 6 on PC? LIVE Port Tracker")).toBe(true)
    expect(isBoard("GTA 6 recomp, fixing shadows")).toBe(false)
  })
})

describe("parseWatching", () => {
  it.each([
    ["543 watching", 543],
    ["4.6K watching", 4600],
    ["1,204 watching", 1204],
    ['{"text":"176 watching"}', 176],
    ["12K views", null],
    [undefined, null],
  ])("%s", (text, n) => expect(parseWatching(text)).toBe(n))
})

describe("fromLockup", () => {
  const tap = { payload: { browseId: "UC1" } }
  const text = (t: string) => ({ toString: () => t })
  const node = (badge = "THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE") => ({
    content_id: "vid",
    content_image: { overlays: [{ badges: [{ badge_style: badge }] }] },
    metadata: {
      title: text("GTA 6 PC port"),
      image: { renderer_context: { command_context: { on_tap: tap } } },
      metadata: {
        metadata_rows: [
          {
            metadata_parts: [
              { text: null, avatar_stack: { text: { ...text("Leafy "), endpoint: tap } } },
              { text: text("459 watching"), avatar_stack: null },
            ],
          },
          {
            metadata_parts: [
              { text: text("9 watching, says the description"), avatar_stack: null },
            ],
          },
        ],
      },
    },
  })
  const found = {
    videoId: "vid",
    title: "GTA 6 PC port",
    channelId: "UC1",
    channelName: "Leafy",
    viewers: 459,
  }

  it("reads a live result", () => expect(fromLockup(node())).toEqual(found))

  it("finds the channel by its name when the picture has no link", () => {
    const { image: _, ...metadata } = node().metadata
    expect(fromLockup({ ...node(), metadata })).toEqual(found)
  })

  it("leaves out what isn't live, or has no owner", () => {
    expect(fromLockup(node("THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT"))).toBeNull()
    expect(fromLockup({ ...node(), metadata: { title: text("No one's") } })).toBeNull()
    expect(fromLockup({})).toBeNull()
  })
})
