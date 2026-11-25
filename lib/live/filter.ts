const GAME = /\bgta\s*(?:6|vi)\b|\bgrand theft auto\s*(?:6|vi)\b/i
const PORT =
  /\brecomp(?:ile[rd]?|iling|ilation)?\b|\bemulat(?:or|ion|ing)\b|\bpc port\b|\bport(?:ing)?\b.*\bpc\b|\bcompat(?:ibility)? layer\b|\breverse[- ]engineer|\bport\b.*\btracker\b/i
// Scam streams copy real titles and add a lure, so one lure word is enough to drop a stream.
const LURE =
  /\bdownload|\bfree\b|\bgiveaway|\binstall(?:er)?\b|\btorrent|\bcrack(?:ed)?\b|\bkeys?\b|\blink in\b|\.exe\b|\biso\b|\bmega\.nz|\bdiscord\.gg|\bt\.me\b|\bcrypto|\bairdrop|\bsolana|\$[a-z]{3,}/i

export const isLure = (title: string) => LURE.test(title)

/** A stream found by search has to name the game and the port work, and carry no lure. */
export const isPortStream = (title: string) =>
  GAME.test(title) && PORT.test(title) && !isLure(title)

/** Loops that show a progress board around the clock, as opposed to someone working on a port. */
export const isBoard = (title: string) => /\b24\s*\/\s*7\b|\btracker\b/i.test(title)
