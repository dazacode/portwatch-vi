import { ImageResponse } from "next/og"
import { DIM, INK, NIGHT, ORANGE, Palm, PINK, SUN, shareFonts, TEAL, today } from "@/lib/og-art"
import { SITE } from "@/lib/site"
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
const LANES = 8
// Where the sea meets the sky.
const HORIZON = 560
// The track: names on the left, the road from 0% to the finish at 100%.
const NAMES = 200
const ROAD_LEFT = 60 + NAMES
const ROAD = W - 60 - ROAD_LEFT - 30
const LANE = 66
const CAR = 44

/** One value per dash, so each has a key of its own. */
const DASHES = Array.from({ length: 16 }, (_, n) => n)

const short = (name: string, n = 13) => (name.length > n ? `${name.slice(0, n - 1)}…` : name)
const at = (score: number) => (Math.max(0, Math.min(100, score)) / 100) * ROAD

/** The dashes down the middle of a lane. */
function Dashes() {
  return (
    <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: LANE / 2 - 1 }}>
      {DASHES.map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "absolute",
            left: (i * ROAD) / 16,
            width: ROAD / 32,
            height: 2,
            background: "rgba(255,243,246,0.18)",
          }}
        />
      ))}
    </div>
  )
}

/** The chequered line at 100%, down every lane. */
function Finish({ lanes }: { lanes: number }) {
  const rows = Math.ceil((lanes * LANE) / 10)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        left: NAMES + ROAD,
        top: 0,
        width: 20,
      }}
    >
      {Array.from({ length: rows }, (_, n) => n).map((r) => (
        <div key={r} style={{ display: "flex", height: 10 }}>
          <div style={{ display: "flex", width: 10, background: r % 2 ? NIGHT : INK }} />
          <div style={{ display: "flex", width: 10, background: r % 2 ? INK : NIGHT }} />
        </div>
      ))}
    </div>
  )
}

function Lane({ p, lead }: { p: Project; lead: boolean }) {
  const x = at(p.rating)
  return (
    <div style={{ display: "flex", position: "relative", height: LANE, alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: NAMES,
          paddingRight: 16,
          alignItems: "flex-end",
        }}
      >
        <span
          style={{ fontSize: 22, fontWeight: 800, color: lead ? INK : "rgba(255,243,246,0.9)" }}
        >
          {short(p.name)}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: p.isPrivate ? DIM : TEAL,
          }}
        >
          {p.isPrivate ? "PRIVATE CODE" : "PUBLIC CODE"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: ROAD,
          height: LANE - 8,
          background: lead ? "rgba(255,61,154,0.16)" : "rgba(255,243,246,0.06)",
          borderTop: "1px solid rgba(255,243,246,0.08)",
          borderBottom: "1px solid rgba(255,243,246,0.08)",
        }}
      >
        <Dashes />
        {/* The trail behind the car. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: (LANE - 8) / 2 - 3,
            width: x,
            height: 6,
            borderRadius: 3,
            background: lead
              ? `linear-gradient(90deg, rgba(62,230,216,0.2), ${PINK} 60%, ${ORANGE})`
              : "linear-gradient(90deg, rgba(194,52,138,0.15), rgba(194,52,138,0.85))",
            ...(lead && { boxShadow: "0 0 18px rgba(255,61,154,0.7)" }),
          }}
        />
        {/* The car: its rank, where our score puts it. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: x - CAR / 2,
            top: (LANE - 8 - CAR) / 2,
            width: CAR,
            height: CAR,
            borderRadius: CAR / 2,
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Anton",
            fontSize: 24,
            color: lead ? NIGHT : INK,
            background: lead
              ? `linear-gradient(135deg, ${SUN}, ${ORANGE} 50%, ${PINK})`
              : "#3a1d5e",
            border: lead ? `2px solid ${SUN}` : "2px solid rgba(255,243,246,0.35)",
            ...(lead && { boxShadow: "0 0 26px rgba(255,154,60,0.9)" }),
          }}
        >
          {p.rank}
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: x + CAR / 2 + 8,
            top: (LANE - 8) / 2 - 15,
            fontFamily: "Anton",
            fontSize: 24,
            color: lead ? ORANGE : DIM,
          }}
        >
          {p.rating}%
        </div>
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
  const field = ranked.slice(0, LANES)
  const leader = field[0]
  const open = leader && !leader.isPrivate && leader.repo
  const line = open ? "is public" : "leads the race"
  const fonts = await shareFonts(`${line} is public leads the race`)
  const host = new URL(SITE.url).host

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
      {/* The sun behind the name, setting into the sea, with its stripes. */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 250,
          top: HORIZON - 440,
          width: 500,
          height: 500,
          borderRadius: 250,
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
            top: HORIZON - 170 + i * 32,
            height: 6 + i * 3,
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
      <Palm left={-40} bottom={H - HORIZON - 30} size={230} />
      <Palm left={130} bottom={H - HORIZON - 14} size={140} flip />
      <Palm left={W - 190} bottom={H - HORIZON - 30} size={235} flip />
      <Palm left={W - 300} bottom={H - HORIZON - 12} size={125} />

      {/* Who leads, and the news. */}
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 36 }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 6,
            color: "rgba(255,243,246,0.85)",
          }}
        >
          VIPORTLIVE · {today().toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Anton",
            fontSize: 44,
            letterSpacing: 2,
            marginTop: 10,
            textShadow: `3px 3px 0 ${NIGHT}`,
          }}
        >
          GTA VI ON PC · THE RACE
        </div>
        {leader && (
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: 200,
              lineHeight: 1,
              marginTop: 18,
              color: INK,
              textShadow: `0 0 40px rgba(255,61,154,0.9), 6px 6px 0 ${NIGHT}`,
            }}
          >
            {leader.name.toUpperCase()}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: "Yellowtail",
            fontSize: 96,
            marginTop: -26,
            color: SUN,
            textShadow: `0 0 22px ${PINK}, 4px 4px 0 ${NIGHT}`,
          }}
        >
          {line}
        </div>
        {leader && (
          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
            {open && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 18px",
                  borderRadius: 30,
                  background: "rgba(20,10,38,0.82)",
                  border: `2px solid ${TEAL}`,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                <span style={{ color: TEAL, letterSpacing: 2 }}>CODE OUT</span>
                <span>github.com/{leader.repo}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 18px",
                borderRadius: 30,
                background: "rgba(20,10,38,0.82)",
                border: `2px solid ${ORANGE}`,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              <span style={{ color: ORANGE, fontFamily: "Anton", fontSize: 26 }}>
                #{leader.rank}
              </span>
              <span>{leader.rating}% our score</span>
            </div>
          </div>
        )}
      </div>

      {/* The race: the top eight, each where our score puts it. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 60,
          right: 60,
          top: HORIZON + 44,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: "2px solid rgba(255,61,154,0.6)",
            paddingBottom: 6,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 32, letterSpacing: 1 }}>
            THE TOP {field.length}
          </div>
          <div style={{ display: "flex", fontSize: 15, color: DIM }}>
            our score, out of 100% · finish = the whole game at 30 fps
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <Finish lanes={field.length} />
          {field.map((p, i) => (
            <Lane key={p.id} p={p} lead={i === 0} />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 16, color: DIM, marginTop: 14 }}>
          Our score counts a claim half until people outside the project confirm it.
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
        <span>{host}</span>
      </div>
    </div>,
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  )
}
