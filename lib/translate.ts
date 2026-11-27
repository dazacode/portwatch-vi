import { findLanguage, SOURCE_LANGUAGE } from "@/lib/languages"

/**
 * Page translation by Google Translate's website widget. Its script is only loaded once a visitor
 * picks a language, so nobody else sends the page to Google. The choice is kept in the cookie the
 * widget itself reads.
 */
const COOKIE = "googtrans"
const SCRIPT = "https://translate.google.com/translate_a/element.js?cb=__pwTranslateInit"
const HOLDER = "google_translate_element"

declare global {
  interface Window {
    __pwTranslateInit?: () => void
    google?: {
      translate?: {
        TranslateElement: new (options: Record<string, unknown>, id: string) => unknown
      }
    }
  }
}

/** The language the visitor picked, or English. */
export function chosenLanguage(): string {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]*\/([^;]+)/)
  const code = match ? decodeURIComponent(match[1]) : SOURCE_LANGUAGE
  return findLanguage(code) ? code : SOURCE_LANGUAGE
}

/** The widget sets its cookie on the host and on the parent domain, so both are written. */
function writeCookie(value: string, maxAge: number) {
  const host = location.hostname
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`]
  for (const domain of new Set(domains)) {
    // biome-ignore lint/suspicious/noDocumentCookie: the widget reads this cookie, and the Cookie Store API isn't in every browser
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${domain ? `; domain=${domain}` : ""}`
  }
}

/** Says which language the page is in, for screen readers, spell-checkers and hyphenation. */
function markDocument(code: string) {
  const language = findLanguage(code)
  const root = document.documentElement
  root.lang = language?.tag ?? SOURCE_LANGUAGE
  root.dir = language?.rtl ? "rtl" : "ltr"
}

/**
 * Translation swaps the page's text nodes for its own, and React then fails to remove or insert
 * next to the ones it made. These two let React carry on instead of breaking the page.
 */
function guardReact() {
  const proto = Node.prototype as unknown as {
    __pwGuarded?: boolean
    removeChild: (child: Node) => Node
    insertBefore: (node: Node, reference: Node | null) => Node
  }
  if (proto.__pwGuarded) return
  proto.__pwGuarded = true
  const removeChild = proto.removeChild
  proto.removeChild = function (this: Node, child: Node) {
    if (child.parentNode !== this) return child
    return removeChild.call(this, child)
  }
  const insertBefore = proto.insertBefore
  proto.insertBefore = function (this: Node, node: Node, reference: Node | null) {
    if (reference && reference.parentNode !== this) return node
    return insertBefore.call(this, node, reference)
  }
}

let loading: Promise<void> | null = null

function loadWidget(): Promise<void> {
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    guardReact()
    if (!document.getElementById(HOLDER)) {
      const holder = document.createElement("div")
      holder.id = HOLDER
      holder.hidden = true
      holder.setAttribute("aria-hidden", "true")
      document.body.append(holder)
    }
    window.__pwTranslateInit = () => {
      const Element = window.google?.translate?.TranslateElement
      if (!Element) return reject(new Error("Google Translate did not start"))
      new Element({ pageLanguage: SOURCE_LANGUAGE, autoDisplay: false }, HOLDER)
      resolve()
    }
    const script = document.createElement("script")
    script.src = SCRIPT
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error("Google Translate could not be reached"))
    }
    document.head.append(script)
  })
  return loading
}

/** The widget's own picker, which it fills in a moment after it starts. */
async function widgetSelect(): Promise<HTMLSelectElement | null> {
  for (let i = 0; i < 50; i++) {
    const select = document.querySelector<HTMLSelectElement>("select.goog-te-combo")
    if (select?.options.length) return select
    await new Promise((r) => setTimeout(r, 100))
  }
  return null
}

/** Google wraps the text it has translated in these. */
const hasTranslatedText = () =>
  /\btranslated-(ltr|rtl)\b/.test(document.documentElement.className) &&
  !!document.querySelector("font[style*='vertical-align']")

async function waitForTranslation(ms = 12_000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (hasTranslatedText()) return true
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

/** Leaves the page in English, so a failed attempt doesn't stick. */
function forget() {
  writeCookie("", 0)
  markDocument(SOURCE_LANGUAGE)
}

export class TranslationError extends Error {}

async function apply(code: string) {
  try {
    await loadWidget()
  } catch {
    throw new TranslationError("Google Translate couldn't be loaded.")
  }
  const select = await widgetSelect()
  if (!select) throw new TranslationError("Google Translate didn't start.")
  if (select.value !== code) {
    select.value = code
    select.dispatchEvent(new Event("change"))
  }
  if (!(await waitForTranslation())) {
    throw new TranslationError("Google Translate didn't send a translation back.")
  }
  // Only once it has worked, so the page never claims a language it isn't in.
  markDocument(code)
}

/** Picks up a language chosen on an earlier visit. */
export async function resumeTranslation() {
  const code = chosenLanguage()
  if (code === SOURCE_LANGUAGE) return
  try {
    await apply(code)
  } catch (error) {
    forget()
    throw error
  }
}

/** Translates the page into `code`, or back to the original English. Throws when it can't. */
export async function translateTo(code: string) {
  if (code === SOURCE_LANGUAGE) {
    writeCookie("", 0)
    // The widget's own way back leaves some text translated. A fresh page doesn't.
    location.reload()
    return
  }
  const before = chosenLanguage()
  writeCookie(`/${SOURCE_LANGUAGE}/${code}`, 60 * 60 * 24 * 365)
  try {
    await apply(code)
  } catch (error) {
    if (before === SOURCE_LANGUAGE) forget()
    else writeCookie(`/${SOURCE_LANGUAGE}/${before}`, 60 * 60 * 24 * 365)
    throw error
  }
}
