/** Brands of graphics card a build has run on, in the order the filter offers them. */
export const GPUS = ["AMD", "NVIDIA", "Intel", "Mac"] as const

export type Gpu = (typeof GPUS)[number]

const isGpu = (value: unknown): value is Gpu => GPUS.some((g) => g === value)

/**
 * Upstream's `gpu` field: the cards a build has run on, main one first, from its README's test
 * machine or the owner's report. Left off when nobody has said. Anything else in it is dropped.
 */
export const gpusOf = (value: unknown): Gpu[] => (Array.isArray(value) ? value.filter(isGpu) : [])

/** "Mac" means Apple's own graphics, so it isn't a card. */
export const gpuTitle = (gpu: Gpu) =>
  gpu === "Mac" ? "Runs on a Mac" : `Runs on ${gpu} graphics cards`
