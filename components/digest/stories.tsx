"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { utcDay } from "@/lib/format"
import {
  applyFilters,
  type Filters,
  MAX_QUERY,
  NO_FILTERS,
  parseFilters,
  SORTS,
  type Sort,
  type Story,
  TOPICS,
  toQuery,
} from "@/lib/stories"

type Props = {
  stories: Story[]
  /** False without a digest: then nothing is known about importance. */
  sorted: boolean
}

const URL_DELAY = 250
const PAGE = 60

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

/** Filters live in the address, so a view can be shared. Typing reaches it after a short pause. */
export function Stories(props: Props) {
  const filters = parseFilters(useSearchParams())
  const [q, setQ] = useState(filters.q)
  const written = useRef(filters.q)

  useEffect(() => {
    if (filters.q === written.current) return
    written.current = filters.q
    setQ(filters.q)
  }, [filters.q])

  function save(next: Filters) {
    written.current = parseFilters(new URLSearchParams(toQuery(next))).q
    // Other parameters, such as the news page's tab, stay as they are.
    const params = new URLSearchParams(window.location.search)
    for (const key of ["q", "topic", "category", "sort"]) params.delete(key)
    for (const [key, value] of new URLSearchParams(toQuery(next))) params.set(key, value)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
  }

  const pending = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(pending.current), [])

  return (
    <StoriesView
      {...props}
      filters={{ ...filters, q }}
      onChange={(next) => {
        clearTimeout(pending.current)
        setQ(next.q)
        if (next.q === q || !next.q) save(next)
        else pending.current = setTimeout(() => save(next), URL_DELAY)
      }}
    />
  )
}

/** What the server sends before the address is known: the newest, unfiltered. */
export const StoriesFallback = (props: Props) => (
  <StoriesView {...props} filters={NO_FILTERS} onChange={() => {}} />
)

function StoriesView({
  stories,
  sorted,
  filters,
  onChange,
}: Props & { filters: Filters; onChange: (next: Filters) => void }) {
  const [shown, setShown] = useState(PAGE)
  const search = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<Filters>) => {
    setShown(PAGE)
    onChange({ ...filters, ...patch })
  }
  const clear = () => {
    set(NO_FILTERS)
    search.current?.focus()
  }
  const found = applyFilters(stories, filters)
  const filtered = Boolean(toQuery(filters))
  const written = stories.some((s) => s.summary)

  return (
    <>
      <search
        aria-label="Filter stories"
        className="pane mt-2 grid items-end gap-3 p-4 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap sm:p-5"
      >
        <div className="col-span-full sm:w-64">
          <Field id="news-q" label="Search stories">
            <input
              ref={search}
              id="news-q"
              type="search"
              value={filters.q}
              maxLength={MAX_QUERY}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => set({ q: e.target.value })}
              className="h-11 w-full min-w-0 rounded-full border border-input bg-(--pane) px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring sm:h-9 dark:bg-input/30 pointer-fine:text-sm"
            />
          </Field>
        </div>
        <Field id="news-topic" label="Topic">
          <NativeSelect
            className="w-full sm:w-fit"
            id="news-topic"
            value={filters.topic}
            onChange={(e) => set({ topic: e.target.value })}
          >
            <NativeSelectOption value="all">Every topic</NativeSelectOption>
            {TOPICS.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t} ({stories.filter((s) => s.topic === t).length})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="news-sort" label="Sort by">
          <NativeSelect
            className="w-full sm:w-fit"
            id="news-sort"
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as Sort })}
          >
            {Object.entries(SORTS)
              .filter(([key]) => sorted || key !== "important")
              .map(([key, label]) => (
                <NativeSelectOption key={key} value={key}>
                  {label}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>
        <div className="col-span-full flex w-full flex-wrap items-center gap-x-4 gap-y-2">
          <p role="status" className="text-sm font-semibold">
            {found.length === stories.length
              ? `${stories.length} stories`
              : `${found.length} of ${stories.length} stories`}
          </p>
          {filtered && (
            <Button variant="outline" size="sm" className="max-sm:h-11" onClick={clear}>
              Clear filters
            </Button>
          )}
          {written && (
            <p className="w-full text-xs text-muted-foreground">
              Topics, importance and the line under some headlines come from an AI model that has
              read only the headline. It can be wrong.
            </p>
          )}
        </div>
      </search>

      {found.length > 0 ? (
        <>
          <ul className="pane mt-4 px-5 py-2 wrap-anywhere">
            {found.slice(0, shown).map((s) => (
              <li key={s.id} className="border-b py-3 last:border-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {s.title}
                </a>
                {s.summary && (
                  <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                    AI summary of the headline from {s.outlet}: {s.summary}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.outlet}, {utcDay(s.date)}, via {s.via}, {s.topic}
                  {s.similar > 0 && `, ${s.similar} more like it`}
                </p>
              </li>
            ))}
          </ul>
          {found.length > shown && (
            <Button
              variant="outline"
              className="mt-4 max-sm:h-11"
              onClick={() => setShown(shown + PAGE)}
            >
              Show {Math.min(PAGE, found.length - shown)} more
            </Button>
          )}
        </>
      ) : (
        <Empty className="pane mt-4">
          <EmptyHeader>
            <EmptyTitle>{stories.length ? "No story matches" : "No stories yet"}</EmptyTitle>
            <EmptyDescription>
              {stories.length ? "Try other words, or every topic." : "The next harvest adds them."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button variant="outline" size="sm" className="max-sm:h-11" onClick={clear}>
                Show all {stories.length} stories
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </>
  )
}
