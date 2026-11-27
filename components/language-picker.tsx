"use client"

import { Check, Languages, Search } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  findLanguage,
  LANGUAGES,
  type Language,
  languageName,
  preferredLanguages,
  SOURCE_LANGUAGE,
} from "@/lib/languages"
import { chosenLanguage, resumeTranslation, translateTo } from "@/lib/translate"
import { cn } from "@/lib/utils"

type Row = { language: Language; own: string; english: string; key: string }

/** Lower case and without accents, so "espanol" finds "Español". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

export function LanguagePicker() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(SOURCE_LANGUAGE)
  const [query, setQuery] = useState("")
  const [failed, setFailed] = useState(false)
  const [browser, setBrowser] = useState<readonly string[]>([])
  const searchId = useId()
  const countId = useId()

  useEffect(() => {
    setCurrent(chosenLanguage())
    setBrowser(navigator.languages ?? [navigator.language])
    resumeTranslation().catch(() => setFailed(true))
  }, [])

  // Names are only worked out once the list is opened.
  const rows = useMemo<Row[]>(() => {
    if (!open) return []
    return LANGUAGES.map((language) => {
      const own = languageName(language)
      const english = languageName(language, SOURCE_LANGUAGE)
      return { language, own, english, key: fold(`${own} ${english} ${language.code}`) }
    }).sort((a, b) => a.english.localeCompare(b.english, SOURCE_LANGUAGE))
  }, [open])

  const needle = fold(query.trim())
  const shown = needle ? rows.filter((r) => r.key.includes(needle)) : rows
  const suggested = needle
    ? []
    : preferredLanguages(browser)
        .map((l) => rows.find((r) => r.language === l))
        .filter((r): r is Row => !!r)

  const currentLanguage = findLanguage(current)
  const currentName = currentLanguage ? languageName(currentLanguage, SOURCE_LANGUAGE) : "English"

  const choose = (code: string) => {
    setOpen(false)
    setQuery("")
    if (code === current) return
    setCurrent(code)
    setFailed(false)
    translateTo(code).catch(() => setFailed(true))
  }

  const list = (items: Row[], label: string) => (
    <ul aria-label={label} className="grid gap-0.5">
      {items.map(({ language, own, english }) => {
        const selected = language.code === current
        return (
          <li key={language.code}>
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => choose(language.code)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-left outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring",
                selected && "bg-foreground/8 font-semibold"
              )}
            >
              <span className="min-w-0 flex-1">
                {/* In its own language, so a screen reader says it properly. */}
                <span lang={language.tag} dir={language.rtl ? "rtl" : "ltr"} className="block">
                  {own}
                </span>
                {own !== english && (
                  <span className="block text-xs font-normal text-muted-foreground">{english}</span>
                )}
              </span>
              {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Language: ${currentName}`}
        aria-haspopup="dialog"
        data-language-picker
        title="Change language"
        onClick={() => setOpen(true)}
      >
        <Languages aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="gap-0 data-[side=right]:w-full sm:data-[side=right]:max-w-sm"
        >
          <SheetHeader className="gap-1 p-5 pr-12">
            <SheetTitle className="text-xl font-extrabold tracking-tight">Language</SheetTitle>
            <SheetDescription>
              Google Translate translates the page for you, so some wording may be off. Picking a
              language sends the page's text to Google.
            </SheetDescription>
          </SheetHeader>
          <div className="px-5 pb-3">
            <label htmlFor={searchId} className="sr-only">
              Search languages
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search languages"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={countId}
                className="h-11 w-full rounded-full border border-input bg-(--pane) pr-4 pl-10 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
            <p id={countId} aria-live="polite" className="sr-only">
              {needle ? `${shown.length} ${shown.length === 1 ? "language" : "languages"}` : ""}
            </p>
          </div>
          {failed && (
            <p
              role="alert"
              className="mx-5 mb-3 rounded-2xl bg-destructive/10 px-4 py-3 text-destructive"
            >
              Google Translate couldn't be reached. Check your connection or ad blocker, then try
              again.
            </p>
          )}
          {/* The names are already in their own languages: translating them would scramble them. */}
          <nav
            aria-label="Languages"
            translate="no"
            className="notranslate min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            {current !== SOURCE_LANGUAGE && !needle && (
              <div className="mb-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => choose(SOURCE_LANGUAGE)}
                >
                  Show the original (English)
                </Button>
              </div>
            )}
            {suggested.length > 0 && (
              <section aria-labelledby={`${searchId}-yours`} className="mb-3">
                <h3
                  id={`${searchId}-yours`}
                  className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Your languages
                </h3>
                {list(suggested, "Your languages")}
              </section>
            )}
            <section aria-labelledby={`${searchId}-all`}>
              <h3
                id={`${searchId}-all`}
                className={cn(
                  "px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                  needle && "sr-only"
                )}
              >
                All languages
              </h3>
              {shown.length ? (
                list(shown, "All languages")
              ) : (
                <p className="px-3 py-6 text-center text-muted-foreground">
                  No language matches “{query}”.
                </p>
              )}
            </section>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
