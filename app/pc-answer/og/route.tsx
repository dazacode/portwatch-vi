import { ImageResponse } from "next/og"
import { ANSWER } from "@/lib/site"

export const dynamic = "force-static"

export const GET = () =>
  new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff3f6",
        background: "linear-gradient(180deg, #120c21 0%, #24144a 55%, #8a2680 100%)",
      }}
    >
      <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>{ANSWER.name}</div>
      <div style={{ fontSize: 290, fontWeight: 900, lineHeight: 1.1, color: "#ff9ad6" }}>No.</div>
      <div style={{ fontSize: 34 }}>{ANSWER.host}</div>
    </div>,
    { width: 1200, height: 630 }
  )
