/**
 * Reads which graphics card the browser draws with, from the WebGL renderer string, and finds it in
 * the checker's lists. Browsers don't expose the processor or how much memory there is, so those
 * stay with the reader. Nothing leaves the browser.
 */
import { GPUS, MACS, slug } from "@/lib/pc-check"

export type Detection =
  /** A card on the list. `others` are the same card with another memory size. */
  | { kind: "gpu"; name: string; gpu: string; others: string[]; laptop: boolean }
  /** An Apple chip on the list, in every GPU size Apple sells it, smallest first. */
  | { kind: "mac"; name: string; chip: string; macs: string[] }
  | { kind: "unlisted"; name: string; integrated: boolean; oldMac: boolean }
  /** The browser didn't say, or said something we can't trust. */
  | { kind: "hidden"; name: string; reason: "none" | "software" | "masked" | "approximate" }

/** "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 …, D3D11)" → "NVIDIA GeForce RTX 4070" */
export function cleanRenderer(raw: string) {
  let s = raw.trim()
  const angle = s.match(/^ANGLE \((.*)\)$/)
  if (angle) {
    const parts = angle[1].split(", ")
    s = parts[1] ?? parts[0]
  }
  return s
    .replace(/^ANGLE Metal Renderer: /, "")
    .replace(/\((R|TM)\)/gi, "")
    .replace(/\s*\(0x[0-9a-f]+\)/gi, "")
    .replace(/\s*\(.*$/, "")
    .replace(/\/PCIe.*$/i, "")
    .replace(/\s+(Direct3D|OpenGL|Vulkan|D3D|vs_).*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** How a card's name appears in a renderer string: no brand word, no memory size. */
const keyOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/^geforce /, "")
    .replace(/^radeon (?=rx )/, "")
    .replace(/ \d+gb$/, "")

// Longest first, so "rtx 4070 ti super" is tried before "rtx 4070".
const KEYS = [...new Set(GPUS.map((g) => keyOf(g.name)))].sort((a, b) => b.length - a.length)

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const contains = (text: string, key: string) =>
  new RegExp(`(^|[^a-z0-9])${escapeRegExp(key)}($|[^a-z0-9])`).test(text)

const INTEGRATED =
  /intel.*(uhd|iris|hd graphics)|^amd radeon graphics$|radeon \d{3}m|vega \d+ graphics|adreno|mali/i

export function matchRenderer(raw: string | null | undefined): Detection {
  if (!raw) return { kind: "hidden", name: "", reason: "none" }
  const name = cleanRenderer(raw)
  if (/swiftshader|llvmpipe|softpipe|basic render|software/i.test(raw)) {
    return { kind: "hidden", name, reason: "software" }
  }
  // Firefox gives a stand-in from a short list, which may not be the card at all.
  if (/, or similar$/i.test(raw.trim())) return { kind: "hidden", name, reason: "approximate" }
  // Safari says only this.
  if (/^apple gpu$/i.test(name)) return { kind: "hidden", name, reason: "masked" }

  const apple = name.match(/\bapple (m\d+)(?: (pro|max|ultra))?\b/i)
  if (apple) {
    const tier = apple[2] ? apple[2][0].toUpperCase() + apple[2].slice(1).toLowerCase() : ""
    const chip = [apple[1].toUpperCase(), tier].filter(Boolean).join(" ")
    const pattern = new RegExp(`^${slug(chip)}-\\d+$`)
    const macs = MACS.filter((m) => pattern.test(m.id)).map((m) => m.id)
    if (macs.length > 0) return { kind: "mac", name: `Apple ${chip}`, chip, macs }
    return { kind: "unlisted", name: `Apple ${chip}`, integrated: false, oldMac: true }
  }

  const text = name.toLowerCase()
  const key = KEYS.find((k) => contains(text, k))
  if (key) {
    // The larger memory size first: it is the one more often sold under the plain name.
    const [first, ...rest] = GPUS.filter((g) => keyOf(g.name) === key).sort(
      (a, b) => b.vram - a.vram
    )
    return {
      kind: "gpu",
      name,
      gpu: first.id,
      others: rest.map((g) => g.id),
      laptop: /laptop|mobile|max-q/i.test(text),
    }
  }
  return { kind: "unlisted", name, integrated: INTEGRATED.test(name), oldMac: false }
}

/** The renderer the browser draws with, or null if it won't say. Browser only. */
export function readRenderer(): string | null {
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    if (!gl) return null
    const info = gl.getExtension("WEBGL_debug_renderer_info")
    const value = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return typeof value === "string" ? value : null
  } catch {
    return null
  }
}
