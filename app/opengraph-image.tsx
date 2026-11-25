import { ImageResponse } from "next/og"
import { SITE } from "@/lib/site"

export const alt = `${SITE.name}: ${SITE.description}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 72,
        color: "#fff3f6",
        background: "linear-gradient(180deg, #24144a 0%, #8a2680 62%, #f0754e 100%)",
      }}
    >
      <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4 }}>{SITE.name}</div>
      <div style={{ fontSize: 36, marginTop: 12 }}>Who is live, and does GTA VI run on PC yet?</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 8 }}>
        <div style={{ height: 10, width: 1056, background: "#ff3d8b" }} />
        <div style={{ height: 10, width: 1056, background: "#ffb454" }} />
        <div style={{ height: 10, width: 1056, background: "#4fd8d8" }} />
      </div>
    </div>,
    size
  )
}
