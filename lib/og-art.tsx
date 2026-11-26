/** The Vice City look the share images have in common: colours, fonts and the palms. */

export const INK = "#fff3f6"
export const DIM = "rgba(255,243,246,0.62)"
export const PINK = "#ff3d9a"
export const ORANGE = "#ff9a3c"
export const TEAL = "#3ee6d8"
export const SUN = "#ffe66d"
export const NIGHT = "#140a26"

/** A font from Google Fonts, cut down to the letters used. Null if it can't be had. */
export async function googleFont(family: string, weight: number, text: string) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(4000) }
      )
    ).text()
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
    if (!url) return null
    return await (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer()
  } catch {
    return null
  }
}

/** Anton for numbers and headlines, Yellowtail for the script line, Schibsted for the rest. */
export async function shareFonts(script: string) {
  const words = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%.·#"
  const [anton, yellowtail, regular, bold, heavy] = await Promise.all([
    googleFont("Anton", 400, words),
    googleFont("Yellowtail", 400, script),
    googleFont("Schibsted+Grotesk", 400, ""),
    googleFont("Schibsted+Grotesk", 700, ""),
    googleFont("Schibsted+Grotesk", 800, ""),
  ])
  return [
    anton && { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
    yellowtail && {
      name: "Yellowtail",
      data: yellowtail,
      weight: 400 as const,
      style: "normal" as const,
    },
    regular && { name: "Schibsted", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "Schibsted", data: bold, weight: 700 as const, style: "normal" as const },
    heavy && { name: "Schibsted", data: heavy, weight: 800 as const, style: "normal" as const },
  ].filter((f) => f !== null)
}

export const today = () =>
  new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

/** A palm tree in silhouette, drawn from plain curves. */
export function Palm({
  left,
  bottom,
  size,
  flip = false,
}: {
  left: number
  bottom: number
  size: number
  flip?: boolean
}) {
  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 100 160"
      aria-hidden="true"
      style={{ position: "absolute", left, bottom }}
    >
      <g transform={flip ? "translate(100 0) scale(-1 1)" : undefined}>
        <path d="M52 160 C50 120 46 80 54 40 L58 40 C52 80 56 120 60 160 Z" fill={NIGHT} />
        <path d="M56 40 C40 30 20 34 4 50 C22 40 40 40 56 44 Z" fill={NIGHT} />
        <path d="M56 40 C46 22 28 14 10 16 C30 22 44 30 55 44 Z" fill={NIGHT} />
        <path d="M56 40 C60 20 74 8 92 6 C78 16 66 28 58 44 Z" fill={NIGHT} />
        <path d="M56 40 C74 34 90 40 100 56 C86 46 72 44 57 45 Z" fill={NIGHT} />
        <path d="M56 40 C64 46 70 60 70 76 C64 62 60 52 54 44 Z" fill={NIGHT} />
        <path d="M56 40 C46 48 40 62 42 78 C46 64 50 54 57 45 Z" fill={NIGHT} />
      </g>
    </svg>
  )
}
