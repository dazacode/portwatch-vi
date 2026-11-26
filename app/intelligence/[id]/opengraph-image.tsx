import { ImageResponse } from "next/og"
import { utcDay } from "@/lib/format"
import { confidenceLabel, getIntel, KIND_LABEL, sourceCount } from "@/lib/intel"

export const revalidate = 86400
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "VIPortLive intelligence report"

/** A branded card. No game image: a leaked-build frame can't be told apart automatically. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = await getIntel()
  const item = file.items.find((i) => i.id === id)
  const title = item?.title ?? "VIPortLive Intelligence"
  const confidence = item ? confidenceLabel(item) : ""
  const kind = item ? (KIND_LABEL[item.kind] ?? item.kind) : "Intelligence"
  const sources = item ? sourceCount(item) : 0
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0d0718",
        color: "#fff3f6",
        padding: 64,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 200, height: 6, background: "#ff3d9a" }} />
          <div style={{ width: 120, height: 6, background: "#ff9a3c" }} />
          <div style={{ width: 80, height: 6, background: "#3ee6d8" }} />
        </div>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: "#ff9ad0" }}>
          VIPORTLIVE / {kind.toUpperCase()}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 70 ? 54 : 68,
          lineHeight: 1.12,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          fontSize: 24,
          color: "rgba(255,243,246,0.66)",
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          <span style={{ color: "#fff3f6" }}>{confidence}</span>
          <span>
            {sources} source{sources === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {item && <span>{utcDay(item.at)}</span>}
          <span>viportlive.com</span>
        </div>
      </div>
    </div>,
    { ...size }
  )
}
