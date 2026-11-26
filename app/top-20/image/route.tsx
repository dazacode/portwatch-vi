import { ImageResponse } from "next/og"
import { BASELINE_FPS, STEPS } from "@/lib/stages.mjs"
import { getProjects, isGone, type Project } from "@/lib/standings"
import {
  getActivity,
  getEvidence,
  getMilestones,
  getRecords,
  getStandings,
  getTracker,
} from "@/lib/tracker"

// Fresh with the board, like the standings page.
export const revalidate = 300

const W = 1080
const H = 1350
const TOP = 20
// Where the sea meets the sky.
const HORIZON = 520

const INK = "#fff3f6"
const DIM = "rgba(255,243,246,0.62)"
const PINK = "#ff3d9a"
const ORANGE = "#ff9a3c"
const TEAL = "#3ee6d8"
const NIGHT = "#140a26"

/** A font from Google Fonts, cut down to the letters used. Null if it can't be had. */
async function googleFont(family: string, weight: number, text: string) {
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

const short = (name: string, n = 17) => (name.length > n ? `${name.slice(0, n - 1)}…` : name)

/** A palm tree in silhouette, drawn from plain curves. */
function Palm({
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

/** One project's bar: our score solid, its claim as the lighter part behind it. */
function Bar({ ours, claimed, lead }: { ours: number; claimed: number; lead: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        height: 10,
        width: "100%",
        borderRadius: 5,
        background: "rgba(255,243,246,0.1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${claimed}%`,
          borderRadius: 5,
          background: "rgba(255,243,246,0.22)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${ours}%`,
          borderRadius: 5,
          background: lead
            ? `linear-gradient(90deg, ${PINK}, ${ORANGE})`
            : `linear-gradient(90deg, #c2348a, #e0742f)`,
        }}
      />
    </div>
  )
}

function Row({ p, lead }: { p: Project; lead: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 45, gap: 14 }}>
      <div
        style={{
          display: "flex",
          width: 46,
          justifyContent: "flex-end",
          fontFamily: "Anton",
          fontSize: 30,
          color: lead ? ORANGE : DIM,
        }}
      >
        {p.rank}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 21, fontWeight: 800, color: INK }}>{short(p.name)}</span>
            {p.isPrivate && (
              <span style={{ fontSize: 13, fontWeight: 700, color: TEAL, letterSpacing: 1 }}>
                PRIVATE
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: INK }}>{p.rating}%</span>
            <span style={{ fontSize: 14, color: DIM }}>{p.score}%</span>
          </div>
        </div>
        <Bar ours={p.rating} claimed={p.score} lead={lead} />
      </div>
    </div>
  )
}

export async function GET() {
  const [tracker, records, evidence, activity, milestones] = await Promise.all([
    getTracker(),
    getRecords(),
    getEvidence(),
    getActivity(),
    getMilestones(),
  ])
  const standings = getStandings(tracker, evidence)
  const everyone = getProjects(
    standings,
    { tracker: records, activity, milestones, evidence },
    { withPrivate: true }
  )
  const ranked = everyone
    .filter((p) => p.rank !== null && !isGone(p))
    .toSorted((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const top = ranked.slice(0, TOP)
  const best = ranked[0]
  const furthest = ranked.toSorted((a, b) => b.score - a.score)[0]
  const playable = ranked.find((p) => p.goals.some((g) => g.key === "smooth" && g.met))
  const stages = STEPS.filter((s) => s.at > 0 && s.at < 100)
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  const words = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%.·"
  const [anton, script, regular, bold, heavy] = await Promise.all([
    googleFont("Anton", 400, words),
    googleFont("Yellowtail", 400, "the road to PC"),
    googleFont("Schibsted+Grotesk", 400, ""),
    googleFont("Schibsted+Grotesk", 700, ""),
    googleFont("Schibsted+Grotesk", 800, ""),
  ])
  const fonts = [
    anton && { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
    script && { name: "Yellowtail", data: script, weight: 400 as const, style: "normal" as const },
    regular && { name: "Schibsted", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "Schibsted", data: bold, weight: 700 as const, style: "normal" as const },
    heavy && { name: "Schibsted", data: heavy, weight: 800 as const, style: "normal" as const },
  ].filter((f) => f !== null)

  const left = top.slice(0, 10)
  const right = top.slice(10, 20)

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: "Schibsted",
        color: INK,
        background: `linear-gradient(180deg, #1b0b3a 0%, #4a1373 ${(HORIZON / H) * 40}%, #a3207f ${(HORIZON / H) * 68}%, #ff4f7b ${(HORIZON / H) * 88}%, ${ORANGE} ${(HORIZON / H) * 100}%, ${NIGHT} ${(HORIZON / H) * 100 + 0.2}%, ${NIGHT} 100%)`,
      }}
    >
      {/* The sun, setting into the sea, with its stripes. */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 210,
          top: HORIZON - 380,
          width: 420,
          height: 420,
          borderRadius: 210,
          background: `linear-gradient(180deg, #ffe66d 0%, ${ORANGE} 45%, ${PINK} 80%)`,
          display: "flex",
        }}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: HORIZON - 170 + i * 32,
            height: 6 + i * 3,
            background: i < 2 ? "#ff6a7f" : "#ff8a5c",
            display: "flex",
          }}
        />
      ))}
      {/* The sea below the horizon hides the bottom of the sun. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON,
          bottom: 0,
          background: NIGHT,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${PINK}, ${ORANGE}, transparent)`,
          display: "flex",
        }}
      />
      <Palm left={-30} bottom={H - HORIZON - 30} size={210} />
      <Palm left={140} bottom={H - HORIZON - 14} size={135} flip />
      <Palm left={W - 180} bottom={H - HORIZON - 30} size={215} flip />
      <Palm left={W - 290} bottom={H - HORIZON - 12} size={120} />

      {/* Title. */}
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40 }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 6,
            color: "rgba(255,243,246,0.8)",
          }}
        >
          VIPORTLIVE · {today.toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Anton",
            fontSize: 140,
            lineHeight: 1.05,
            marginTop: 8,
            color: INK,
            textShadow: `0 0 30px rgba(255,61,154,0.8), 4px 4px 0 ${NIGHT}`,
          }}
        >
          GTA VI ON PC
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Yellowtail",
            fontSize: 64,
            marginTop: -14,
            color: "#ffe66d",
            textShadow: `0 0 18px ${PINK}, 3px 3px 0 ${NIGHT}`,
          }}
        >
          the road to PC
        </div>
      </div>

      {/* Progress, all builds combined: the furthest backed up, and the furthest claimed. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 60,
          right: 60,
          top: HORIZON + 30,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 34, letterSpacing: 1 }}>
            PC PORT PROGRESS
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "Anton", fontSize: 44, color: ORANGE }}>
                {best?.rating ?? 0}%
              </span>
              <span style={{ fontSize: 16, color: DIM }}>backed up</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "Anton", fontSize: 44, color: INK }}>
                {furthest?.score ?? 0}%
              </span>
              <span style={{ fontSize: 16, color: DIM }}>claimed</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{ fontFamily: "Anton", fontSize: 44, color: playable ? TEAL : "#ff6a7f" }}
              >
                {playable ? "YES" : "NOT YET"}
              </span>
              <span style={{ fontSize: 16, color: DIM }}>playable</span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            position: "relative",
            height: 26,
            marginTop: 10,
            borderRadius: 13,
            background: "rgba(255,243,246,0.1)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${furthest?.score ?? 0}%`,
              borderRadius: 13,
              background: "rgba(255,243,246,0.25)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${best?.rating ?? 0}%`,
              borderRadius: 13,
              background: `linear-gradient(90deg, ${TEAL}, ${PINK} 55%, ${ORANGE})`,
              boxShadow: `0 0 22px rgba(255,61,154,0.6)`,
            }}
          />
        </div>
        <div style={{ display: "flex", position: "relative", height: 22, marginTop: 6 }}>
          {stages.map((s) => (
            <div
              key={s.label}
              style={{
                position: "absolute",
                left: `${s.at}%`,
                display: "flex",
                fontSize: 14,
                color: DIM,
                borderLeft: "1px solid rgba(255,243,246,0.35)",
                paddingLeft: 5,
              }}
            >
              {s.label}
            </div>
          ))}
          <div
            style={{ position: "absolute", right: 0, display: "flex", fontSize: 14, color: DIM }}
          >
            Complete
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 15, color: DIM, marginTop: 4 }}>
          {best
            ? `Furthest backed up: ${best.name}. Furthest claimed: ${furthest?.name}. Playable means ${BASELINE_FPS}+ fps and a clean picture, with proof.`
            : ""}
        </div>
      </div>

      {/* The top 20, by our score. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 60,
          right: 60,
          top: HORIZON + 210,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: "2px solid rgba(255,61,154,0.6)",
            paddingBottom: 6,
          }}
        >
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 30, letterSpacing: 1 }}>
            THE TOP 20 BUILDS
          </div>
          <div style={{ display: "flex", fontSize: 14, color: DIM }}>our score · claimed</div>
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {left.map((p, i) => (
              <Row key={p.id} p={p} lead={i === 0} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {right.map((p) => (
              <Row key={p.id} p={p} lead={false} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 26,
          justifyContent: "space-between",
          fontSize: 14,
          color: DIM,
        }}
      >
        <span>Fan projects running the console game. No official PC version exists.</span>
        <span>Our score: claims count half until others confirm them</span>
      </div>
    </div>,
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  )
}
