import { ImageResponse } from "next/og"
import { DIM, INK, NIGHT, ORANGE, Palm, PINK, SUN, shareFonts, TEAL, today } from "@/lib/og-art"
import { SITE } from "@/lib/site"
import { getProjects, isGone, type Project } from "@/lib/standings"
import {
  getActivity,
  getDrop,
  getEvidence,
  getMilestones,
  getRecords,
  getStandings,
  getTracker,
} from "@/lib/tracker"

// Fresh with the board, like the standings page.
export const revalidate = 300

/** Wide, for the cards X, Discord and YouTube draw. The tall one is /race/image. */
const W = 1600
const H = 900
const PACK = 10
const HORIZON = 600
const LEFT = 70
const SPLIT = 830

const playable = (p: Project) => p.goals.some((g) => g.key === "smooth" && g.met)
const short = (name: string, n = 15) => (name.length > n ? `${name.slice(0, n - 1)}…` : name)

/** True only when GitHub plainly says the repo is gone (404) or blocked (451). A timeout says nothing. */
async function repoDown(repo: string) {
  try {
    const res = await fetch(`https://github.com/${repo}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    })
    return res.status === 404 || res.status === 451
  } catch {
    return false
  }
}

function Stat({ label, value, color = INK }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px 16px",
        borderRadius: 16,
        background: "rgba(20,10,38,0.78)",
        border: "1px solid rgba(255,243,246,0.16)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2.5, color: DIM }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color, marginTop: 2 }}>{value}</span>
    </div>
  )
}

/** One car in the chasing pack: where it is, how far behind the leader. */
function Chaser({ p, lead }: { p: Project; lead: Project }) {
  const gap = Math.round((lead.rating - p.rating) * 10) / 10
  const width = 190
  return (
    <div style={{ display: "flex", alignItems: "center", height: 58, gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Anton",
          fontSize: 24,
          background: "#3a1d5e",
          border: "2px solid rgba(255,243,246,0.35)",
        }}
      >
        {p.rank}
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: 230, flexShrink: 0 }}>
        <span style={{ fontSize: 25, fontWeight: 800 }}>{short(p.name)}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: p.isPrivate ? DIM : TEAL,
          }}
        >
          {p.stage.toUpperCase()} · {p.isPrivate ? "PRIVATE CODE" : "PUBLIC CODE"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", width, gap: 6 }}>
        <div
          style={{
            display: "flex",
            height: 10,
            width,
            borderRadius: 5,
            background: "rgba(255,243,246,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              height: 10,
              width: (Math.min(100, p.rating) / 100) * width,
              borderRadius: 5,
              background: `linear-gradient(90deg, rgba(194,52,138,0.4), ${PINK})`,
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          width: 96,
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "Anton", fontSize: 28 }}>{p.rating}%</span>
        <span style={{ fontSize: 14, color: DIM }}>{gap > 0 ? `${gap} behind` : "level"}</span>
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
  const everyone = getProjects(
    getStandings(tracker, evidence),
    { tracker: records, activity, milestones, evidence },
    { withPrivate: true }
  )
  const ranked = everyone
    .filter((p) => p.rank !== null && !isGone(p))
    .toSorted((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const [leader, ...rest] = ranked
  const pack = rest.slice(0, PACK - 1)
  const atPlayable = ranked.filter(playable)
  const runnable = ranked.filter((p) => p.claimedStage === "Runnable" || p.stage === "Runnable")
  const open = leader && !leader.isPrivate && leader.repo
  const down = open ? await repoDown(leader.repo as string) : false
  const code = !leader ? "" : leader.isPrivate ? "Private" : down ? "In forks" : "Public"
  const line = leader && playable(leader) ? "is playable on PC" : "leads the race"
  const drop = getDrop(tracker)
  const days = drop?.released
    ? Math.max(0, Math.floor((Date.now() - Date.parse(drop.at)) / 864e5))
    : null
  const fonts = await shareFonts(`${line} leads the race is playable on PC`)
  const host = new URL(SITE.url).host

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        fontFamily: "Schibsted",
        color: INK,
        background: `linear-gradient(180deg, #1b0b3a 0%, #4a1373 30%, #a3207f 50%, #ff4f7b 62%, ${ORANGE} ${(HORIZON / H) * 100}%, ${NIGHT} ${(HORIZON / H) * 100 + 0.2}%, ${NIGHT} 100%)`,
      }}
    >
      {/* The sun setting behind the leader, and its stripes on the water. */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: HORIZON - 420,
          width: 520,
          height: 520,
          borderRadius: 260,
          background: `linear-gradient(180deg, ${SUN} 0%, ${ORANGE} 45%, ${PINK} 80%)`,
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
            top: HORIZON - 150 + i * 28,
            height: 5 + i * 3,
            background: i < 2 ? "#ff6a7f" : "#ff8a5c",
            display: "flex",
          }}
        />
      ))}
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
      <Palm left={-50} bottom={H - HORIZON - 30} size={220} />
      <Palm left={640} bottom={H - HORIZON - 14} size={130} flip />

      {/* The pack's side is a dark glass pane, so the names read over the sky. */}
      <div
        style={{
          position: "absolute",
          left: SPLIT,
          top: 112,
          right: 50,
          bottom: 100,
          borderRadius: 32,
          background: "rgba(16,8,32,0.82)",
          border: "1px solid rgba(255,61,154,0.4)",
          display: "flex",
        }}
      />

      {/* Top bar. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: LEFT,
          right: 50,
          top: 36,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 8,
              background: PINK,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            <div
              style={{ display: "flex", width: 10, height: 10, borderRadius: 5, background: INK }}
            />
            LIVE
          </div>
          <span
            style={{
              fontFamily: "Anton",
              fontSize: 34,
              letterSpacing: 1.5,
              textShadow: `3px 3px 0 ${NIGHT}`,
            }}
          >
            GTA VI ON PC · THE RACE
          </span>
        </div>
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 4,
            color: "rgba(255,243,246,0.85)",
          }}
        >
          {today().toUpperCase()}
          {days !== null ? ` · DAY ${days + 1} SINCE THE EXE DROPPED` : ""}
        </span>
      </div>

      {/* The leader. */}
      {leader && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: LEFT,
            top: 150,
            width: SPLIT - LEFT - 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                padding: "4px 16px",
                borderRadius: 30,
                fontFamily: "Anton",
                fontSize: 28,
                color: NIGHT,
                background: `linear-gradient(135deg, ${SUN}, ${ORANGE} 50%, ${PINK})`,
              }}
            >
              #1
            </div>
            {leader.pick && (
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textShadow: `2px 2px 0 ${NIGHT}`,
                }}
              >
                IN THE LEAD
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: 190,
              lineHeight: 1,
              marginTop: 10,
              textShadow: `0 0 40px rgba(255,61,154,0.9), 7px 7px 0 ${NIGHT}`,
            }}
          >
            {leader.name.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Yellowtail",
              fontSize: 76,
              marginTop: -22,
              marginLeft: 8,
              color: SUN,
              textShadow: `0 0 22px ${PINK}, 4px 4px 0 ${NIGHT}`,
            }}
          >
            {line}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
            <Stat label="STAGE" value={leader.stage} color={playable(leader) ? TEAL : INK} />
            <Stat label="SPEED" value={leader.fps > 0 ? `${leader.fps} fps` : "Unmeasured"} />
            <Stat label="OUR SCORE" value={`${leader.rating}%`} color={ORANGE} />
            <Stat label="CLAIMED" value={`${leader.score}%`} />
            <Stat label="CODE" value={code} color={leader.isPrivate ? DIM : TEAL} />
          </div>
          {down && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 22,
                fontSize: 21,
                color: "rgba(255,243,246,0.9)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: TEAL,
                }}
              />
              Its original repo is down, but the code lives on in dozens of forks.
            </div>
          )}
        </div>
      )}

      {/* The chasing pack. */}
      {leader && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: SPLIT + 36,
            top: 128,
            right: 80,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderBottom: "2px solid rgba(255,61,154,0.6)",
              paddingBottom: 6,
              marginBottom: 6,
            }}
          >
            <span style={{ fontFamily: "Anton", fontSize: 32, letterSpacing: 1 }}>
              THE CHASING PACK
            </span>
            <span style={{ fontSize: 15, color: DIM }}>our score, out of 100%</span>
          </div>
          {pack.map((p) => (
            <Chaser key={p.id} p={p} lead={leader} />
          ))}
        </div>
      )}

      {/* The ticker. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 74,
          alignItems: "center",
          gap: 26,
          padding: "0 50px 0 70px",
          background: "rgba(8,4,18,0.92)",
          borderTop: `3px solid ${PINK}`,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <span style={{ color: TEAL, letterSpacing: 2 }}>PLAYABLE</span>
        <span>
          {atPlayable.length
            ? `${atPlayable.map((p) => p.name).join(", ")} at 20+ fps with proof`
            : "No build at 20+ fps with proof yet"}
        </span>
        <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: PINK }} />
        <span>{runnable.length} more are Runnable, a character moving in the world</span>
        <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: PINK }} />
        <span>{ranked.length} projects racing</span>
        <span style={{ display: "flex", marginLeft: "auto", color: DIM, fontWeight: 400 }}>
          {host}
        </span>
      </div>
    </div>,
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  )
}
