/**
 * "Can my PC run GTA VI?": a PC's parts against the consoles the game runs on.
 *
 * There is no PC version yet, so nothing here is a requirement. It compares speed with the
 * consoles, from benchmarks, and says which console's version a PC is closest to.
 *
 * Speed is never read from TFLOPS. Newer AMD and NVIDIA cards count two operations a cycle that
 * games rarely get, so an RX 7600 lists twice a PS5's TFLOPS and plays like one. TFLOPS are kept
 * only to show the difference.
 */

export const CHECKED = "2026-11-26"

/* ---------- Graphics cards ---------- */

/**
 * Tom's Hardware's GPU hierarchy, raster, the mean of its 1080p and 1440p results, with the
 * GeForce RTX 3060 12GB at 100. Cards missing from its 2026 table are bridged from its 2022-2024
 * one, through the cards both tables share. A PS5 sits between an RTX 2070 Super and an RX 6700,
 * the two cards Digital Foundry uses for it.
 */
export const PS5_GPU = 110

type GpuRow = [
  name: string,
  vram: number,
  tflops: number,
  at1080: number,
  at1440: number,
  extra?: { rt?: false; estimate?: true },
]

export type GpuBrand = "AMD" | "NVIDIA" | "Intel"

export type Gpu = {
  id: string
  name: string
  brand: GpuBrand
  vram: number
  /** FP32 on paper, at the maker's boost clock. */
  tflops: number
  perf: number
  /** Hardware ray tracing. Every console uses it in GTA VI. */
  rt: boolean
  estimate: boolean
}

const NO_RT = { rt: false } as const

const GPU_ROWS: Record<GpuBrand, GpuRow[]> = {
  AMD: [
    ["Radeon RX Vega 64", 8, 12.7, 77, 74, NO_RT],
    ["Radeon VII", 16, 13.4, 93, 96, NO_RT],
    ["Radeon RX 5700 XT", 8, 9.8, 100, 96, NO_RT],
    ["Radeon RX 6500 XT", 4, 5.8, 41, 32],
    ["Radeon RX 6600", 8, 8.9, 84, 80],
    ["Radeon RX 6600 XT", 8, 10.6, 102, 97],
    ["Radeon RX 6650 XT", 8, 10.8, 105, 91],
    ["Radeon RX 6700", 10, 11.3, 117, 116],
    ["Radeon RX 6700 XT", 12, 13.2, 129, 130],
    ["Radeon RX 6750 XT", 12, 13.3, 135, 137],
    ["Radeon RX 6800", 16, 16.2, 171, 173],
    ["Radeon RX 6800 XT", 16, 20.7, 182, 190],
    ["Radeon RX 6900 XT", 16, 23.0, 190, 200],
    ["Radeon RX 6950 XT", 16, 23.7, 200, 214],
    ["Radeon RX 7600", 8, 21.8, 114, 108],
    ["Radeon RX 7600 XT", 16, 22.6, 124, 120],
    ["Radeon RX 7700 XT", 12, 35.2, 167, 174],
    ["Radeon RX 7800 XT", 16, 37.3, 193, 202],
    ["Radeon RX 7900 GRE", 16, 46.0, 216, 230],
    ["Radeon RX 7900 XT", 20, 51.5, 236, 258],
    ["Radeon RX 7900 XTX", 24, 61.4, 263, 292],
    ["Radeon RX 9060", 8, 21.4, 130, 128, { estimate: true }],
    ["Radeon RX 9060 XT 8GB", 8, 25.6, 152, 149],
    ["Radeon RX 9060 XT 16GB", 16, 25.6, 160, 161],
    ["Radeon RX 9070 GRE", 12, 34.3, 196, 207],
    ["Radeon RX 9070", 16, 36.1, 229, 248],
    ["Radeon RX 9070 XT", 16, 48.7, 255, 278],
  ],
  NVIDIA: [
    ["GeForce GTX 1060 6GB", 6, 4.4, 43, 41, NO_RT],
    ["GeForce GTX 1080", 8, 8.9, 72, 70, NO_RT],
    ["GeForce GTX 1080 Ti", 11, 11.3, 89, 90, NO_RT],
    ["GeForce GTX 1650 Super", 4, 4.4, 46, 38, NO_RT],
    ["GeForce GTX 1660 Super", 6, 5.0, 63, 60, NO_RT],
    ["GeForce RTX 2060", 6, 6.5, 75, 72],
    ["GeForce RTX 2060 Super", 8, 7.2, 87, 87],
    ["GeForce RTX 2070", 8, 7.5, 93, 93],
    ["GeForce RTX 2070 Super", 8, 9.1, 106, 105],
    ["GeForce RTX 2080", 8, 10.1, 113, 117],
    ["GeForce RTX 2080 Super", 8, 11.2, 117, 119],
    ["GeForce RTX 2080 Ti", 11, 13.4, 134, 138],
    ["TITAN RTX", 24, 16.3, 138, 146],
    ["GeForce RTX 3050 8GB", 8, 9.1, 73, 71],
    ["GeForce RTX 3060 12GB", 12, 12.7, 100, 100],
    ["GeForce RTX 3060 Ti", 8, 16.2, 121, 122],
    ["GeForce RTX 3070", 8, 20.3, 142, 139],
    ["GeForce RTX 3070 Ti", 8, 21.7, 154, 160],
    ["GeForce RTX 3080 10GB", 10, 29.8, 181, 196],
    ["GeForce RTX 3080 Ti", 12, 34.1, 194, 213],
    ["GeForce RTX 3090", 24, 35.6, 200, 218],
    ["GeForce RTX 3090 Ti", 24, 40.0, 214, 238],
    ["GeForce RTX 4060", 8, 15.1, 116, 114],
    ["GeForce RTX 4060 Ti 8GB", 8, 22.1, 143, 141],
    ["GeForce RTX 4070", 12, 29.1, 181, 186],
    ["GeForce RTX 4070 Super", 12, 35.5, 206, 218],
    ["GeForce RTX 4070 Ti", 12, 40.1, 220, 234],
    ["GeForce RTX 4070 Ti Super", 16, 44.1, 230, 248],
    ["GeForce RTX 4080", 16, 48.7, 256, 280],
    ["GeForce RTX 4080 Super", 16, 52.2, 258, 283],
    ["GeForce RTX 4090", 24, 82.6, 299, 342],
    ["GeForce RTX 5050", 8, 13.2, 113, 108],
    ["GeForce RTX 5060", 8, 19.2, 144, 143],
    ["GeForce RTX 5060 Ti 16GB", 16, 23.7, 171, 175],
    ["GeForce RTX 5070", 12, 30.9, 216, 230],
    ["GeForce RTX 5070 Ti", 16, 43.9, 253, 279],
    ["GeForce RTX 5080", 16, 56.3, 271, 306],
    ["GeForce RTX 5090", 32, 104.8, 331, 399],
  ],
  Intel: [
    ["Arc A580", 8, 10.4, 87, 88],
    ["Arc A750", 8, 14.7, 94, 97],
    ["Arc A770 16GB", 16, 17.2, 105, 108],
    ["Arc B570", 10, 11.5, 103, 106],
    ["Arc B580", 12, 13.7, 116, 121],
  ],
}

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/^(geforce |radeon (?=rx ))/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const GPUS: Gpu[] = (Object.keys(GPU_ROWS) as GpuBrand[]).flatMap((brand) =>
  GPU_ROWS[brand].map(([name, vram, tflops, at1080, at1440, extra]) => ({
    id: slug(name),
    name,
    brand,
    vram,
    tflops,
    perf: Math.round((at1080 + at1440) / 2),
    rt: extra?.rt ?? true,
    estimate: extra?.estimate ?? false,
  }))
)

/* ---------- Processors ---------- */

/**
 * TechPowerUp's CPU-limited game results (RTX 4090, 720p) from its Ryzen 7 9800X3D and 7800X3D
 * reviews, with the Ryzen 5 3600 at 100. Estimates are scaled from the nearest chip it tested.
 *
 * Digital Foundry measured the Xbox Series X chip, sold as a desktop kit, at about three quarters
 * of a 3600 in games. A PC carries more (Windows, drivers, no hardware decompression), so a 3600
 * is the processor that keeps pace with a console. That is the console mark here.
 */
export const CONSOLE_CPU = 100

export type CpuBrand = "AMD" | "Intel"

export type Cpu = { id: string; name: string; brand: CpuBrand; perf: number; estimate: boolean }

type CpuRow = [name: string, perf: number, estimate?: true]

const CPU_ROWS: Record<CpuBrand, CpuRow[]> = {
  AMD: [
    ["Ryzen 5 2600", 71],
    ["Ryzen 7 2700X", 79],
    ["Ryzen 5 3600", 100],
    ["Ryzen 7 3700X", 107],
    ["Ryzen 5 5600", 123, true],
    ["Ryzen 5 5600X", 126],
    ["Ryzen 7 5700X", 126],
    ["Ryzen 7 5800X", 128],
    ["Ryzen 7 5800X3D", 154],
    ["Ryzen 9 5900X", 136],
    ["Ryzen 9 5950X", 137],
    ["Ryzen 5 7600X", 155],
    ["Ryzen 7 7700X", 161],
    ["Ryzen 7 7800X3D", 184],
    ["Ryzen 9 7950X", 162],
    ["Ryzen 5 9600X", 163],
    ["Ryzen 7 9800X3D", 198],
    ["Ryzen 9 9950X", 167],
    ["Ryzen 9 9950X3D", 186, true],
  ],
  Intel: [
    ["Core i7-8700K", 101, true],
    ["Core i5-9600K", 96, true],
    ["Core i5-10400F", 100],
    ["Core i5-10600K", 108, true],
    ["Core i7-10700K", 115],
    ["Core i5-11400F", 101],
    ["Core i5-11600K", 122],
    ["Core i5-12400F", 127],
    ["Core i5-12600K", 137],
    ["Core i7-12700K", 149],
    ["Core i5-13600K", 155],
    ["Core i7-13700K", 168],
    ["Core i9-13900K", 173],
    ["Core i5-14600K", 161],
    ["Core i7-14700K", 170],
    ["Core i9-14900K", 174],
    ["Core Ultra 7 265K", 159],
    ["Core Ultra 9 285K", 163],
  ],
}

export const CPUS: Cpu[] = (Object.keys(CPU_ROWS) as CpuBrand[]).flatMap((brand) =>
  CPU_ROWS[brand].map(([name, perf, estimate]) => ({
    id: slug(name),
    name,
    brand,
    perf,
    estimate: estimate ?? false,
  }))
)

/* ---------- Macs ---------- */

/**
 * Apple publishes no GPU clocks or FLOPS. These are estimates: 128 FP32 units a core, at the clock
 * Notebookcheck and others measured (M3 1.38 GHz, M4 1.58 GHz, M5 1.62 GHz, M6 about 1.7 GHz).
 * Apple's units are single-issue, like the consoles', so TFLOPS compare more fairly here than for
 * PC cards. They still only describe the chip on paper: GTA VI has no Mac version.
 */
export type MacChip = { id: string; name: string; gpuCores: number; tflops: number; perf: number }

type MacRow = [chip: string, gpuCores: number, tflops: number]

const MAC_ROWS: MacRow[] = [
  ["M3", 8, 2.8],
  ["M3", 10, 3.5],
  ["M3 Pro", 14, 4.9],
  ["M3 Pro", 18, 6.4],
  ["M3 Max", 30, 10.6],
  ["M3 Max", 40, 14.1],
  ["M3 Ultra", 60, 21.2],
  ["M3 Ultra", 80, 28.3],
  ["M4", 8, 3.2],
  ["M4", 10, 4.0],
  ["M4 Pro", 16, 6.5],
  ["M4 Pro", 20, 8.1],
  ["M4 Max", 32, 12.9],
  ["M4 Max", 40, 16.2],
  ["M5", 8, 3.3],
  ["M5", 10, 4.1],
  ["M5 Pro", 16, 6.6],
  ["M5 Pro", 20, 8.3],
  ["M5 Max", 32, 13.3],
  ["M5 Max", 40, 16.6],
  ["M5 Ultra", 64, 26.5],
  ["M5 Ultra", 80, 33.2],
  ["M6", 12, 5.2],
]

export const PS5_TFLOPS = 10.3

export const MACS: MacChip[] = MAC_ROWS.map(([chip, gpuCores, tflops]) => ({
  id: `${slug(chip)}-${gpuCores}`,
  name: `Apple ${chip}, ${gpuCores}-core GPU`,
  gpuCores,
  tflops,
  perf: Math.round((tflops / PS5_TFLOPS) * PS5_GPU),
}))

/* ---------- The consoles ---------- */

export type TierId = "series-s" | "ps5" | "pro" | "beyond"

export type Tier = {
  id: TierId
  /** "Like …" */
  name: string
  /** The console version it matches, or our own line past them. */
  versions: string
  gpu: number
  cpu: number
  /** System memory a PC needs, in GB. */
  ram: number
  /** Graphics memory a PC needs, and what is comfortable. */
  vram: number
  vramComfortable: number
  /** Unified memory a Mac needs. */
  macMemory: number
  renders: string
  shown: string
  fps: string
  rayTracing: string
}

/** In order. PS5 and Series X run the same version of GTA VI, so they are one step. */
export const TIERS: Tier[] = [
  {
    id: "series-s",
    name: "an Xbox Series S",
    versions: "Xbox Series S",
    gpu: Math.round(PS5_GPU * (4 / PS5_TFLOPS)),
    cpu: CONSOLE_CPU,
    ram: 16,
    vram: 6,
    vramComfortable: 8,
    macMemory: 16,
    renders: "720p",
    shown: "1080p, upscaled with AMD FSR 4",
    fps: "30 fps target, mid-20s for long stretches, about 20 at worst",
    rayTracing: "Ray-traced lighting and reflections, scaled back; softer shadows",
  },
  {
    id: "ps5",
    name: "a PS5 or Xbox Series X",
    versions: "PS5 and Xbox Series X",
    gpu: PS5_GPU,
    cpu: CONSOLE_CPU,
    ram: 16,
    vram: 8,
    vramComfortable: 10,
    macMemory: 24,
    renders: "1440p",
    shown: "4K, upscaled with Rockstar’s TAA",
    fps: "30 fps, dipping into the low 20s in heavy action",
    rayTracing: "Ray-traced lighting and reflections",
  },
  {
    id: "pro",
    name: "a PS5 Pro",
    versions: "PS5 Pro",
    // Digital Foundry: about an RX 9060 XT 16GB, with an RTX 5060 Ti 16GB a little faster.
    gpu: 160,
    cpu: CONSOLE_CPU,
    ram: 16,
    vram: 10,
    vramComfortable: 12,
    macMemory: 32,
    renders: "1440p",
    shown: "4K, upscaled with PSSR 2",
    fps: "A near-steady 30 fps, about 24 at worst",
    rayTracing: "Adds ray-traced shadows",
  },
  {
    id: "beyond",
    name: "more than a PS5 Pro",
    versions: "Past 30 fps (our estimate)",
    // About twice a PS5 in both parts. Rockstar says the consoles stop at 30 because of their CPUs,
    // and 150 is about twice the console chip as Digital Foundry measured it.
    gpu: PS5_GPU * 2,
    cpu: 150,
    ram: 16,
    vram: 12,
    vramComfortable: 16,
    macMemory: 48,
    renders: "Higher than the consoles",
    shown: "Up to you",
    fps: "Room past 30 fps, if the PC version allows it",
    rayTracing: "As much as the PC version offers",
  },
]

/* ---------- The check ---------- */

export type Status = "yes" | "close" | "no"
export type Part = "gpu" | "cpu" | "memory"
export type Storage = "nvme" | "sata" | "hdd"

export const RAM_SIZES = [8, 16, 32, 64] as const
export const MAC_MEMORY = [8, 16, 24, 32, 48, 64, 96, 128] as const

export type Input =
  | { kind: "pc"; gpu: Gpu; cpu: Cpu; ram: number; storage: Storage }
  | { kind: "mac"; chip: MacChip; memory: number; storage: Storage }

export type Warning =
  | "no-rt"
  | "vram-tight"
  | "ram-low"
  | "hdd"
  | "sata"
  | "mac"
  | "estimate"
  | "tflops-overstate"

export type TierResult = { tier: Tier; status: Status; parts: Record<Part, Status> }

export type Result = {
  tiers: TierResult[]
  /** The highest step every part reaches. */
  reached: Tier | null
  /** The next step, when it is only just out of reach. */
  near: Tier | null
  /** What keeps it from the next step: the weakest part there. */
  limit: Part | null
  /** As a share of a PS5's graphics, and of a console's processor. */
  gpuShare: number
  cpuShare: number | null
  warnings: Warning[]
}

/** 95% counts as there: benchmark suites differ by about that much. 80% is close. */
export const ratioStatus = (value: number, mark: number): Status =>
  value >= mark * 0.95 ? "yes" : value >= mark * 0.8 ? "close" : "no"

const RANK: Record<Status, number> = { yes: 0, close: 1, no: 2 }
const worst = (...all: Status[]) => all.reduce((a, b) => (RANK[b] > RANK[a] ? b : a))

function memoryStatus(input: Input, tier: Tier): Status {
  if (input.kind === "mac") return input.memory >= tier.macMemory ? "yes" : "no"
  if (input.ram < tier.ram) return "no"
  if (input.gpu.vram >= tier.vram) return "yes"
  return input.gpu.vram >= tier.vram - 2 ? "close" : "no"
}

export function assess(input: Input): Result {
  const gpuPerf = input.kind === "pc" ? input.gpu.perf : input.chip.perf
  // Every Mac chip from M3 on is ahead of the consoles' processor in benchmarks. Its GPU and the
  // missing Mac version decide, so a Mac is compared on graphics and memory only.
  const cpuPerf = input.kind === "pc" ? input.cpu.perf : null

  const tiers = TIERS.map((tier) => {
    const parts: Record<Part, Status> = {
      gpu: ratioStatus(gpuPerf, tier.gpu),
      cpu: cpuPerf === null ? "yes" : ratioStatus(cpuPerf, tier.cpu),
      memory: memoryStatus(input, tier),
    }
    return { tier, parts, status: worst(parts.gpu, parts.cpu, parts.memory) }
  })

  let top = -1
  while (top + 1 < tiers.length && tiers[top + 1].status === "yes") top++
  const next = tiers[top + 1]
  const reached = top >= 0 ? tiers[top].tier : null
  const near = next?.status === "close" ? next.tier : null

  let limit: Part | null = null
  if (next) {
    // How far each part is from the next step. A part that is already there can't be the limit.
    const { tier, parts } = next
    const memory =
      input.kind === "mac"
        ? input.memory / tier.macMemory
        : Math.min(input.ram / tier.ram, input.gpu.vram / tier.vram)
    const shares: [Part, number][] = [
      ["gpu", gpuPerf / tier.gpu],
      ["cpu", cpuPerf === null ? 1 : cpuPerf / tier.cpu],
      ["memory", memory],
    ]
    limit = shares
      .map(([part, share]): [Part, number] => [part, parts[part] === "yes" ? Infinity : share])
      .reduce((a, b) => (b[1] < a[1] ? b : a))[0]
  }

  const warnings: Warning[] = []
  if (input.kind === "pc") {
    if (!input.gpu.rt) warnings.push("no-rt")
    if (input.ram < 16) warnings.push("ram-low")
    const at = reached ?? TIERS[0]
    if (input.gpu.vram >= at.vram && input.gpu.vram < at.vramComfortable)
      warnings.push("vram-tight")
    if (input.gpu.tflops / PS5_TFLOPS > (input.gpu.perf / PS5_GPU) * 1.3) {
      warnings.push("tflops-overstate")
    }
    if (input.gpu.estimate || input.cpu.estimate) warnings.push("estimate")
  } else {
    warnings.push("mac")
    if (input.memory < 16) warnings.push("ram-low")
  }
  if (input.storage === "hdd") warnings.push("hdd")
  if (input.storage === "sata") warnings.push("sata")

  return {
    tiers,
    reached,
    near,
    limit,
    gpuShare: gpuPerf / PS5_GPU,
    cpuShare: cpuPerf === null ? null : cpuPerf / CONSOLE_CPU,
    warnings,
  }
}

/* ---------- What the consoles have, for the table ---------- */

export const CONSOLES = [
  {
    name: "Xbox Series S",
    cpu: "8 Zen 2 cores, 3.4 GHz with SMT",
    gpu: "20 RDNA 2 CUs at 1.565 GHz, 4 TFLOPS",
    memory: "10 GB (8 GB fast)",
  },
  {
    name: "PS5",
    cpu: "8 Zen 2 cores, up to 3.5 GHz",
    gpu: "36 RDNA 2 CUs at up to 2.23 GHz, 10.3 TFLOPS",
    memory: "16 GB GDDR6",
  },
  {
    name: "Xbox Series X",
    cpu: "8 Zen 2 cores, 3.66 GHz with SMT",
    gpu: "52 RDNA 2 CUs at 1.825 GHz, 12.2 TFLOPS",
    memory: "16 GB (10 GB fast)",
  },
  {
    name: "PS5 Pro",
    cpu: "The PS5’s; a 3.85 GHz mode is reported, not confirmed by Sony",
    gpu: "60 CUs at 2.17 GHz, 16.7 TFLOPS",
    memory: "16 GB GDDR6, plus 2 GB for the system",
  },
] as const

export const SOURCES = [
  {
    label: "Rockstar on resolution, upscaling and 30 fps (Wccftech)",
    url: "https://wccftech.com/grand-theft-auto-vi-amd-fsr-4-xbox-series-s-ray-tracing/",
  },
  {
    label: "Rockstar on ray tracing, and why there is no 60 fps mode (Kotaku)",
    url: "https://kotaku.com/gta-6-wont-get-a-60-fps-mode-even-on-ps5-pro-because-its-not-powerful-enough-2000755979",
  },
  {
    label: "Digital Foundry on PS5 and PS5 Pro (AltChar)",
    url: "https://www.altchar.com/game-news/gta-vi-dips-as-low-as-23fps-on-base-ps5-in-heavy-action-digital-foundry-finds-aJybE7x7IsZa",
  },
  {
    label: "Digital Foundry on Xbox Series X (AltChar)",
    url: "https://www.altchar.com/game-news/gta-vi-runs-slightly-worse-on-xbox-series-x-than-ps5-in-heavy-action-dropping-to-around-20fps-a82743n2RfEW",
  },
  {
    label: "Digital Foundry on Xbox Series S (VGC)",
    url: "https://www.videogameschronicle.com/news/gta-6-xbox-series-s-performance-analysis-admires-the-effort-but-says-significant-frame-drops-are-a-problem/",
  },
  {
    label: "Is GTA VI coming to PC? (VGC)",
    url: "https://www.videogameschronicle.com/guide/gta-6-pc-version/",
  },
  {
    label: "GPU benchmarks hierarchy (Tom’s Hardware)",
    url: "https://www.tomshardware.com/reviews/gpu-hierarchy,4388.html",
  },
  {
    label: "CPU game results, Ryzen 7 9800X3D review (TechPowerUp)",
    url: "https://www.techpowerup.com/review/amd-ryzen-7-9800x3d/17.html",
  },
  {
    label: "The Xbox Series X processor tested as a PC part (Digital Foundry)",
    url: "https://www.digitalfoundry.net/articles/digitalfoundry-2023-amd-4800s-desktop-kit-review-play-pc-games-on-the-xbox-series-x-cpu",
  },
  {
    label: "PS5 Pro against PC graphics cards (Notebookcheck, on Digital Foundry’s tests)",
    url: "https://www.notebookcheck.net/PlayStation-5-Pro-performance-is-roughly-on-par-with-RTX-5060-Ti-Radeon-9060-XT-latest-Digital-Foundry-tests-show.1054099.0.html",
  },
  {
    label: "PS5 specifications (PlayStation Blog)",
    url: "https://blog.playstation.com/2020/03/18/unveiling-new-details-of-playstation-5-hardware-technical-specs/",
  },
  {
    label: "Xbox Series X specifications (Xbox Wire)",
    url: "https://news.xbox.com/en-us/2020/03/16/xbox-series-x-tech/",
  },
  {
    label: "M5 Ultra and M6 (Apple Newsroom)",
    url: "https://www.apple.com/newsroom/2026/08/apple-introduces-m6-and-m5-ultra-for-a-big-leap-in-performance-and-ai-compute/",
  },
] as const
