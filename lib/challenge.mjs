// Stream challenges. The code and the actions come from a secret, the project and the time, so nothing
// is stored: a code can't be known before its window opens, and can be checked for a week afterwards.
import { createHmac } from "node:crypto"

export const WINDOW_MS = 10 * 60_000
const KEEP = (7 * 24 * 60 * 60_000) / WINDOW_MS

const WORDS = [
  "FLAMINGO",
  "PELICAN",
  "MANATEE",
  "GATOR",
  "MARLIN",
  "HERON",
  "CORAL",
  "MANGO",
  "PALMETTO",
  "HIBISCUS",
  "LAGOON",
  "SUNSET",
  "NEON",
  "BOARDWALK",
  "SPEEDBOAT",
  "CONCH",
]

// A code can be pasted over a recording. Doing three things nobody could have guessed can't.
const ACTIONS = {
  menu: [
    "Open the settings and go back",
    "Move the selection down four times, then up twice",
    "Change the brightness one step and put it back",
    "Open the audio settings and stop on the third row",
    "Switch the language list to its last entry without confirming",
    "Back out to the first screen and return",
  ],
  playable: [
    "Turn all the way round to the left",
    "Walk backwards for three seconds",
    "Open the pause menu twice",
    "Look straight up, then straight down",
    "Walk in a small square",
    "Jump three times, then stand still",
    "Turn round to the right and walk back to where you were",
    "Pause on the map, then close it",
  ],
}

export const challengeStage = (claimed) =>
  ["playable", "smooth", "beaten", "complete"].includes(claimed) ? "playable" : "menu"

export function challenge(secret, project, stage, window) {
  const bytes = createHmac("sha256", secret).update(`${project}:${stage}:${window}`).digest()
  const left = [...ACTIONS[stage]]
  const actions = [0, 1, 2].map((i) => left.splice(bytes[8 + i] % left.length, 1)[0])
  return {
    code: `${WORDS[bytes[0] % WORDS.length]}-${1000 + (bytes.readUInt32BE(1) % 9000)}`,
    actions,
    startsAt: new Date(window * WINDOW_MS).toISOString(),
    endsAt: new Date((window + 1) * WINDOW_MS).toISOString(),
  }
}

export const currentWindow = (now = Date.now()) => Math.floor(now / WINDOW_MS)

/** The challenge a code belonged to, if it was issued to this project in the last week. */
export function findChallenge(secret, project, code, now = Date.now()) {
  const latest = currentWindow(now)
  for (let w = latest; w > latest - KEEP; w--) {
    for (const stage of Object.keys(ACTIONS)) {
      const c = challenge(secret, project, stage, w)
      if (c.code === code) return { ...c, stage }
    }
  }
  return null
}
