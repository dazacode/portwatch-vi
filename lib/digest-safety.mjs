// What a model may say on this site. Shared by the digest script, which checks what it writes, and
// the site, which checks what it reads.

/** The same words as lib/live/filter.ts, which Node can't import. A test keeps them equal. */
const LURE =
  /\bdownload|\bfree\b|\bgiveaway|\binstall(?:er)?\b|\btorrent|\bcrack(?:ed)?\b|\bkeys?\b|\blink in\b|\.exe\b|\biso\b|\bmega\.nz|\bdiscord\.gg|\bt\.me\b|\bcrypto|\bairdrop|\bsolana|\$[a-z]{3,}/i

export const isLure = (text) => LURE.test(text)
export const LURE_SOURCE = LURE.source

/** The same rule as lib/hide.ts, for the scripts, which read the files before it is applied. */
const HIDDEN = /portwatch|4lwayz/i
export const isHidden = (value) => HIDDEN.test(JSON.stringify(value) ?? "")
export const HIDDEN_SOURCE = HIDDEN.source

const URL_LIKE =
  /\w+:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|gg|me|ru|to|co|uk|de|fr|dev|app|xyz|cc|tv|ly|gl|nz|site|online|link|info|biz|onion|art|ai|pk|hu|ing|se|sh|so|st|ws|top|club|live|news|cloud)\b/i
const MARKUP = /[<>{}[\]\x60|\\]|\*\*|(?:^|\s)@\w/
const HASH = /\b[0-9a-f]{32,}\b/i

// Ways to get the game. The files themselves may be named, where to find them may not.
const HARD =
  /\b(?:bit)?torrents?\b|\bmagnet\b|\bseed(?:ers?|ing|box)\b|\bmirror(?:s|ed)?\b|\bwarez\b|\bdecrypt\w*|\bpirate (?:site|bay)|\bfile ?host|\bserials?\b|\bpasswords?\b|\b(?:bt|p2p)\b|磁力|种子|分发/i
const THING =
  "(?:executables?|exe|xbox build|leaked build|game build|game files?|game data|iso|leaked files?|leaked cop(?:y|ies)|the (?:leak|files?|build|game))"
const WAY =
  "(?:available|obtain\\w*|grab\\w*|get|gets|getting|acquir\\w*|host(?:s|ed|ing)?|upload\\w*|shar(?:e|es|ed|ing)|distribut\\w*|links?|linked|circulat\\w*|posted|find|found|released? (?:on|via|at|through)|online)"
const ACCESS = new RegExp(
  `\\b${THING}\\b[^.]{0,60}\\b${WAY}\\b|\\b${WAY}\\b[^.]{0,40}\\b${THING}\\b|\\bhow to (?:get|obtain|play|run)\\b|\\bwhere to\\b`,
  "i"
)

const PERSONAL =
  /\bteen(?:s|age\w*)?\b|\b\d+[- ]years?[- ]olds?\b|\bschool\w*|\bkids?\b|\bminors?\b/i

const ORDERS =
  /\b(?:ignore|disregard|forget)\b.{0,30}\b(?:previous|prior|above|earlier|all|any|your|these|instructions?|rules?)\b|\bsystem prompt\b|\byou are (?:now|a|an)\b|\bas an ai\b|\b(?:new|following) instructions?\b|\b(?:assistant|system|user)\s*:/i

/** One line of plain text: no control, zero-width or direction marks. */
export const plain = (value) =>
  typeof value === "string"
    ? value
        .normalize("NFKC")
        .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu, " ")
        .replace(/[\u2010-\u2012]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
    : ""

/** True for scraped text that should not reach the model at all. */
export const isHostile = (text) => isLure(text) || HARD.test(text) || ORDERS.test(text)

/** Why a model's text can't be shown, or null when it can. */
export function unsafe(text, max) {
  if (!text) return "empty"
  if (text.length > max) return "too long"
  if (URL_LIKE.test(text)) return "has a link"
  if (MARKUP.test(text) || HASH.test(text)) return "has markup"
  if (isHidden(text)) return "names what is hidden"
  if (isLure(text)) return "lure word"
  if (HARD.test(text) || ACCESS.test(text)) return "describes access to the game"
  if (ORDERS.test(text)) return "reads like instructions"
  if (PERSONAL.test(text)) return "a private person's details"
  // Headlines arrive cut short, and a line that copies one ends in mid-air.
  if (/\b(?:\d{1,3}(?:,\d{3})+|a|an|the|as|by|of|for|with|its|and|or|to|take)[.…]*$/i.test(text))
    return "cut off"
  const letters = text.match(/\p{L}/gu) ?? []
  const latin = text.match(/\p{Script=Latin}/gu) ?? []
  return latin.length < letters.length * 0.9 ? "not in English" : null
}

const COMMON = new Set(
  "a ai an and api april august cpu december dmca february friday github gpu grand theft auto gta i it its january july june march may monday november october pc project readme rockstar saturday september sunday take take-two the two thursday tuesday vi wednesday windows xbox".split(
    " "
  )
)

// Words that turn a report into a different report. They have to be in the source.
const WEIGHTY = [
  "dmca|take[- ]?downs?|taken down|takes down|took down",
  "lawsuit|\\bsued|\\bsuing|\\bcourt",
  "malware|virus|scam|stealer|phishing",
  "playable",
  "fps|frames? per second",
  "arrest",
  "illegal",
  "stolen|stole",
  "confirm",
  "official",
  "\\bban(?:s|ned)?\\b",
  "complete[ds]?\\b|finished|fully",
  // A cause is a claim of its own.
  "\\bbecause\\b|\\bdue to\\b|\\bled to\\b|\\bcaused?\\b|\\bprompt(?:s|ed)\\b|\\bas a result\\b|\\bafter\\b|\\bfollowing\\b",
  "\\bbefore\\b|\\bearlier\\b",
  "\\bespecially\\b|\\bparticularly\\b",
  "hack",
].map((s) => new RegExp(s, "i"))

const digits = (text) => (text.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]/g, ""))

/** Names, numbers and weighty words must come from the source, so the model can't add its own. */
export function ungrounded(text, source, names = [], title = false) {
  const from = source.toLowerCase().replace(/[’]/g, "'")
  const known = new Set(digits(source))
  if (digits(text).some((n) => n !== "6" && !known.has(n))) return "a number not in the source"
  if (WEIGHTY.some((w) => w.test(text) && !w.test(source))) return "a claim not in the source"
  const has = (word) => from.includes(word.toLowerCase())
  const named = (name) =>
    new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "i").test(
      text
    )
  if (names.some((n) => named(n) && !has(n))) return "a project or outlet not in the source"
  // Capitals mean nothing in a headline.
  if (title) return null
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const words = sentence.match(/[\p{L}\d][\p{L}\d'’-]*/gu) ?? []
    for (const [i, raw] of words.entries()) {
      const word = raw.replace(/['’]s?$/, "")
      const capital = /^\p{Lu}/u.test(word)
      // A sentence starts with a capital anyway. Two in a row there, or one inside, is a name.
      const first = i === 0 && !/^\p{Lu}/u.test(words[1] ?? "") && !/.\p{Lu}/u.test(word)
      if (!capital || first || has(word)) continue
      // "GPU-less", "Xbox-based": each part that is a name has to be known.
      const parts = word.split("-").filter((w) => /^\p{Lu}/u.test(w))
      if (parts.every((w) => COMMON.has(w.toLowerCase()) || has(w))) continue
      return `a name not in the source (${word})`
    }
  }
  return null
}

/** True when the text says who says so. */
export const isAttributed = (text) =>
  /\b(?:says?|said|saying|claims?|claimed|reports?|reported|reportedly|lists?|describes?|according to|mentions?|notes?|writes?|asks?|argues?|alleges?|allegedly|headlines?|posts?|tells|told|explains?|suggests?|outlines?|covers?|discuss(?:es)?|commits?|pull requests?|readme|tracker)\b/i.test(
    text
  )

/**
 * The key of a line about one commit, pull request or tracker change. The site looks it up the same way.
 * @param {{ url?: string, date?: string, text?: string }} item
 */
export function noteId({ url, date, text }) {
  const path = url?.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(commit|pull)\/(\w+)/)
  if (path)
    return path[2] === "commit" ? `commit:${path[3].slice(0, 7)}` : `pull:${path[1]}#${path[3]}`
  return date && text ? `change:${date}:${text.slice(0, 60)}` : null
}
