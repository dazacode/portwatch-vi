import { describe, expect, it } from "vitest"
import { findChannels, mergeChannels } from "@/scripts/lib/channels.mjs"

describe("findChannels", () => {
  it("finds channels on every platform", () => {
    const text =
      "[Twitch](https://twitch.tv/some_dev) kick.com/some-dev, https://www.youtube.com/@Some.Dev. " +
      "https://youtube.com/channel/UCabcdefghijklmnopqrstuv https://rumble.com/user/someone"
    expect(findChannels(text).map((c) => `${c.platform}:${c.handle}`)).toEqual([
      "twitch:some_dev",
      "kick:some-dev",
      "youtube:@Some.Dev",
      "youtube:UCabcdefghijklmnopqrstuv",
      "rumble:user/someone",
    ])
  })
  it("ignores videos, clips and site pages", () => {
    const text =
      "https://youtube.com/watch?v=abcdefghijk https://twitch.tv/directory " +
      "https://twitch.tv/videos/123 https://rumble.com/v7abc-x.html https://kick.com/browse"
    expect(findChannels(text)).toEqual([])
  })
})

describe("mergeChannels", () => {
  const manual = {
    platform: "rumble",
    handle: "user/a",
    name: "a",
    effortId: "x",
    addedBy: "manual",
  }
  const auto = { platform: "twitch", handle: "dev", name: "dev", effortId: "x", addedBy: "readme" }
  const efforts = [{ id: "x", stats: {} }]

  it("adds what the README links and never duplicates a manual entry", () => {
    const readmes = new Map([["x", "https://twitch.tv/dev https://rumble.com/user/A"]])
    expect(mergeChannels([manual], efforts, readmes)).toEqual([manual, auto])
  })
  it("drops a README entry when the link goes", () => {
    expect(mergeChannels([manual, auto], efforts, new Map([["x", "nothing"]]))).toEqual([manual])
  })
  it("keeps entries when the README could not be read", () => {
    expect(mergeChannels([manual, auto], efforts, new Map())).toEqual([manual, auto])
  })
  it("drops README entries of a project taken offline", () => {
    const gone = [{ id: "x", nuked: { at: "2026-11-24" }, stats: {} }]
    expect(mergeChannels([manual, auto], gone, new Map())).toEqual([manual])
  })
})
