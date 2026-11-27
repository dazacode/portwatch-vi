/**
 * The languages Google Translate offers, by the code it uses. Names are not written here: the
 * browser gives each one in its own language and in the visitor's (Intl.DisplayNames).
 */
const CODES =
  "af sq am ar hy as ay az bm eu be bn bho bs bg ca ceb ny zh-CN zh-TW co hr cs da dv doi nl en eo et ee tl fi fr fy gl ka de el gn gu ht ha haw iw hi hmn hu is ig ilo id ga it ja jw kn kk km rw gom ko kri ku ckb ky lo la lv ln lt lg lb mk mai mg ms ml mt mi mr mni-Mtei lus mn my ne no or om ps fa pl pt pa qu ro ru sm sa gd nso sr st sn sd si sk sl so es su sw sv tg ta tt te th ti ts tr tk ak uk ur ug uz vi cy xh yi yo zu".split(
    " "
  )

/** Google's old codes, and the tags browsers and screen readers know. */
const TAG: Record<string, string> = { iw: "he", jw: "jv" }

/** Written right to left. */
const RTL = new Set(["ar", "iw", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb"])

export type Language = {
  /** Google Translate's code. */
  code: string
  /** The BCP 47 tag, for lang="" and Intl. */
  tag: string
  rtl: boolean
}

export const SOURCE_LANGUAGE = "en"

export const LANGUAGES: Language[] = CODES.map((code) => ({
  code,
  tag: TAG[code] ?? code,
  rtl: RTL.has(code),
}))

export const findLanguage = (code: string) => LANGUAGES.find((l) => l.code === code)

/** A language's name, in `inLanguage`. The code when the browser doesn't know it. */
export function languageName(language: Language, inLanguage: string = language.tag) {
  try {
    const name = new Intl.DisplayNames([inLanguage], { type: "language", fallback: "none" }).of(
      language.tag
    )
    if (!name) return language.code
    // Some names come lower-case ("español"); a list reads better with capitals.
    return name.charAt(0).toLocaleUpperCase(inLanguage) + name.slice(1)
  } catch {
    return language.code
  }
}

/** The visitor's own languages, in their order, that we offer. */
export function preferredLanguages(browser: readonly string[]): Language[] {
  const found: Language[] = []
  for (const wanted of browser) {
    const lower = wanted.toLowerCase()
    const base = lower.split("-")[0]
    const match =
      LANGUAGES.find((l) => l.tag.toLowerCase() === lower) ??
      // zh-HK and zh-MO read traditional characters.
      (base === "zh"
        ? findLanguage(/-(tw|hk|mo|hant)/.test(lower) ? "zh-TW" : "zh-CN")
        : LANGUAGES.find((l) => l.tag.toLowerCase() === base))
    if (match && !found.includes(match)) found.push(match)
  }
  return found
}
