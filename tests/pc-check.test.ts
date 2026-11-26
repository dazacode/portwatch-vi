import { describe, expect, it } from "vitest"
import { assess, CPUS, GPUS, type Input, MACS, PS5_GPU, TIERS } from "@/lib/pc-check"

const gpu = (id: string) => {
  const found = GPUS.find((g) => g.id === id)
  if (!found) throw new Error(`no GPU ${id}`)
  return found
}
const cpu = (id: string) => {
  const found = CPUS.find((c) => c.id === id)
  if (!found) throw new Error(`no CPU ${id}`)
  return found
}
const pc = (g: string, c: string, ram = 16): Input => ({
  kind: "pc",
  gpu: gpu(g),
  cpu: cpu(c),
  ram,
  storage: "nvme",
})

describe("the parts lists", () => {
  it("has one entry per id", () => {
    for (const list of [GPUS, CPUS, MACS]) {
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("has no chip Apple never made", () => {
    expect(MACS.some((m) => m.id.startsWith("m4-ultra"))).toBe(false)
  })

  it("puts the console steps in order", () => {
    const marks = TIERS.map((t) => t.gpu)
    expect([...marks].sort((a, b) => a - b)).toEqual(marks)
  })
})

describe("matching a console", () => {
  it("puts the cards Digital Foundry uses for a PS5 at a PS5", () => {
    for (const id of ["rtx-2070-super", "rx-6700"]) {
      expect(assess(pc(id, "ryzen-5-3600")).reached?.id).toBe("ps5")
    }
  })

  it("reads speed from benchmarks, not TFLOPS", () => {
    // 21.8 TFLOPS, twice a PS5 on paper, about a PS5 in games.
    const result = assess(pc("rx-7600", "ryzen-5-3600"))
    expect(result.reached?.id).toBe("ps5")
    expect(result.gpuShare).toBeLessThan(1.1)
    expect(result.warnings).toContain("tflops-overstate")
  })

  it("puts an RX 9060 XT 16GB at a PS5 Pro", () => {
    expect(assess(pc("rx-9060-xt-16gb", "ryzen-5-5600x")).reached?.id).toBe("pro")
  })

  it("finds the processor holding a fast card back", () => {
    const result = assess(pc("rtx-4090", "ryzen-7-2700x"))
    expect(result.reached).toBeNull()
    expect(result.limit).toBe("cpu")
  })

  it("only goes past the consoles with both parts about twice as fast", () => {
    expect(assess(pc("rtx-4090", "ryzen-7-9800x3d")).reached?.id).toBe("beyond")
    expect(assess(pc("rtx-4090", "ryzen-5-3600")).reached?.id).toBe("pro")
    expect(assess(pc("rtx-3060-12gb", "ryzen-7-9800x3d")).reached?.id).toBe("series-s")
  })

  it("calls an RTX 3060 close to a PS5", () => {
    const result = assess(pc("rtx-3060-12gb", "ryzen-5-3600"))
    expect(result.near?.id).toBe("ps5")
    expect(result.limit).toBe("gpu")
  })

  it("flags a card without ray tracing, whatever its speed", () => {
    expect(assess(pc("gtx-1080-ti", "ryzen-5-3600")).warnings).toContain("no-rt")
  })

  it("blames the part furthest from the next step", () => {
    // 8 GB is short of a PS5 Pro, but the card is shorter still.
    expect(assess(pc("rx-7600", "ryzen-5-3600")).limit).toBe("gpu")
    expect(assess(pc("rx-6700-xt", "ryzen-5-5600x")).limit).toBe("gpu")
    // And the other way round: an RTX 3070 is nearer a PS5 Pro in speed than in its 8 GB.
    expect(assess(pc("rtx-3070", "ryzen-5-5600x")).limit).toBe("memory")
    expect(assess(pc("rtx-4070-super", "ryzen-5-3600")).limit).toBe("cpu")
  })

  it("needs 16 GB of memory", () => {
    const result = assess(pc("rtx-4070", "ryzen-5-5600x", 8))
    expect(result.reached).toBeNull()
    expect(result.limit).toBe("memory")
    expect(result.warnings).toContain("ram-low")
  })

  it("compares a Mac on its graphics, on paper", () => {
    const max = MACS.find((m) => m.id === "m4-max-40")
    if (!max) throw new Error("no M4 Max")
    const result = assess({ kind: "mac", chip: max, memory: 48, storage: "nvme" })
    expect(result.reached?.id).toBe("pro")
    expect(result.cpuShare).toBeNull()
    expect(result.warnings).toContain("mac")
  })

  it("keeps the Series S mark at its share of a PS5's compute", () => {
    expect(TIERS[0].gpu / PS5_GPU).toBeCloseTo(4 / 10.3, 1)
  })
})
