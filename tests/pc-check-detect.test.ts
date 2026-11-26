import { describe, expect, it } from "vitest"
import { cleanRenderer, matchRenderer } from "@/lib/pc-check-detect"

/** What Chrome and Edge give on Windows. */
const win = (vendor: string, name: string) =>
  `ANGLE (${vendor}, ${name} (0x00001234) Direct3D11 vs_5_0 ps_5_0, D3D11)`
const mac = (chip: string) => `ANGLE (Apple, ANGLE Metal Renderer: ${chip}, Unspecified Version)`
const found = (raw: string) => {
  const d = matchRenderer(raw)
  return d.kind === "gpu" ? d.gpu : d.kind
}

describe("reading the graphics card from the browser", () => {
  it("cleans the renderer strings browsers give", () => {
    expect(cleanRenderer(win("NVIDIA", "NVIDIA GeForce RTX 4070"))).toBe("NVIDIA GeForce RTX 4070")
    expect(cleanRenderer(win("Intel", "Intel(R) Arc(TM) A770 Graphics"))).toBe(
      "Intel Arc A770 Graphics"
    )
    expect(
      cleanRenderer("ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080/PCIe/SSE2, OpenGL 4.5.0)")
    ).toBe("NVIDIA GeForce RTX 3080")
    expect(
      cleanRenderer(
        "ANGLE (AMD, AMD Radeon RX 6800 XT (radeonsi, navi21, LLVM 15.0.7, DRM 3.49), OpenGL 4.6)"
      )
    ).toBe("AMD Radeon RX 6800 XT")
    expect(cleanRenderer(mac("Apple M4 Max"))).toBe("Apple M4 Max")
  })

  it("finds the card, preferring the longest name", () => {
    expect(found(win("NVIDIA", "NVIDIA GeForce RTX 4070"))).toBe("rtx-4070")
    expect(found(win("NVIDIA", "NVIDIA GeForce RTX 4070 Ti SUPER"))).toBe("rtx-4070-ti-super")
    expect(found(win("NVIDIA", "NVIDIA GeForce RTX 4070 SUPER"))).toBe("rtx-4070-super")
    expect(found(win("AMD", "AMD Radeon RX 6700 XT"))).toBe("rx-6700-xt")
    expect(found(win("AMD", "AMD Radeon RX 6700"))).toBe("rx-6700")
    expect(found(win("AMD", "AMD Radeon VII"))).toBe("radeon-vii")
    expect(found(win("Intel", "Intel(R) Arc(TM) B580 Graphics"))).toBe("arc-b580")
    expect(found(win("NVIDIA", "NVIDIA GeForce RTX 3060"))).toBe("rtx-3060-12gb")
    expect(found("NVIDIA TITAN RTX/PCIe/SSE2")).toBe("titan-rtx")
  })

  it("offers the other memory size when the name doesn't say", () => {
    expect(matchRenderer(win("AMD", "AMD Radeon RX 9060 XT"))).toMatchObject({
      kind: "gpu",
      gpu: "rx-9060-xt-16gb",
      others: ["rx-9060-xt-8gb"],
    })
  })

  it("marks a laptop chip", () => {
    expect(matchRenderer(win("NVIDIA", "NVIDIA GeForce RTX 4070 Laptop GPU"))).toMatchObject({
      kind: "gpu",
      gpu: "rtx-4070",
      laptop: true,
    })
  })

  it("finds an Apple chip but not its GPU size", () => {
    expect(matchRenderer(mac("Apple M4 Max"))).toEqual({
      kind: "mac",
      name: "Apple M4 Max",
      chip: "M4 Max",
      macs: ["m4-max-32", "m4-max-40"],
    })
    expect(matchRenderer(mac("Apple M4"))).toMatchObject({ macs: ["m4-8", "m4-10"] })
    expect(matchRenderer(mac("Apple M2 Pro"))).toMatchObject({ kind: "unlisted", oldMac: true })
  })

  it("doesn't trust what browsers hide or approximate", () => {
    expect(matchRenderer("Apple GPU")).toMatchObject({ kind: "hidden", reason: "masked" })
    expect(matchRenderer("NVIDIA GeForce GTX 980, or similar")).toMatchObject({
      kind: "hidden",
      reason: "approximate",
    })
    expect(
      matchRenderer(
        "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"
      )
    ).toMatchObject({ kind: "hidden", reason: "software" })
    expect(matchRenderer(null)).toMatchObject({ kind: "hidden", reason: "none" })
  })

  it("names graphics it can't place", () => {
    expect(matchRenderer(win("Intel", "Intel(R) UHD Graphics 770"))).toMatchObject({
      kind: "unlisted",
      name: "Intel UHD Graphics 770",
      integrated: true,
    })
    expect(matchRenderer(win("NVIDIA", "NVIDIA GeForce GTX 1070"))).toMatchObject({
      kind: "unlisted",
      integrated: false,
    })
  })
})
