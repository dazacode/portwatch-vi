"use client"

import { SlidersHorizontal } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"
import { RanksTabs } from "@/components/ranks-tabs"
import { ProjectTable } from "@/components/standings/project-table"
import { Race, type Stage } from "@/components/standings/race"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getRanks, setRanks, useRanks } from "@/components/use-ranks"
import { GPUS, gpuTitle } from "@/lib/gpu"
import type { Frame } from "@/lib/race"
import {
  applyFilters,
  type Code,
  type Entry,
  type Filters,
  MAX_QUERY,
  NO_FILTERS,
  parseFilters,
  SORTS,
  STAGES,
  STATUS_LABEL,
  STATUSES,
  toQuery,
} from "@/lib/standings"

type View = {
  race: Frame[]
  entries: Entry[]
  /** The grouped view, and one table row for each project. Both are drawn on the server. */
  board: React.ReactNode
  rows: Record<string, React.ReactNode>
}

/** The same projects twice: with private builds left out of the ranks, and ranked with the rest. */
type Props = { ranked: View; everyone: View; stages: Stage[] }

const CODES: { key: Code; label: string }[] = [
  { key: "all", label: "All" },
  { key: "public", label: "Public" },
  { key: "private", label: "Private" },
]

const URL_DELAY = 250

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
export function Explorer(props: Props) {
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
    const query = toQuery(next)
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
  }

  // The choice of ranks is shared with the leaders panel. A link that makes it is remembered, and from
  // then on the address follows the choice.
  const ranks = useRanks()
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the address the page was opened with
  useEffect(() => {
    if (filters.ranks === "everyone") setRanks("everyone")
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: when either of the two changes
  useEffect(() => {
    if (getRanks() !== filters.ranks) save({ ...filters, ranks: getRanks() })
  }, [ranks, filters.ranks])

  const pending = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(pending.current), [])

  return (
    <ExplorerView
      {...props}
      filters={{ ...filters, q, ranks }}
      onChange={(next) => {
        clearTimeout(pending.current)
        setQ(next.q)
        if (next.ranks !== ranks) setRanks(next.ranks)
        if (next.q === q || !next.q) save(next)
        else pending.current = setTimeout(() => save(next), URL_DELAY)
      }}
    />
  )
}

/** What the server sends before the address is known: everything, unfiltered. */
export const ExplorerFallback = (props: Props) => (
  <ExplorerView {...props} filters={NO_FILTERS} onChange={() => {}} />
)

function ExplorerView({
  ranked: publicOnly,
  everyone,
  stages,
  filters,
  onChange,
}: Props & { filters: Filters; onChange: (next: Filters) => void }) {
  const { race, entries, board, rows } = filters.ranks === "everyone" ? everyone : publicOnly
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  // The button goes away with the filters, so focus moves to the search.
  const clear = () => {
    onChange({ ...NO_FILTERS, ranks: filters.ranks })
    setOpened(false)
    search.current?.focus()
  }
  const grouped = !toQuery({ ...filters, ranks: NO_FILTERS.ranks })
  const found = applyFilters(entries, filters)
  const count = (test: (e: Entry) => boolean) => entries.filter(test).length
  const search = useRef<HTMLInputElement>(null)
  const [opened, setOpened] = useState(false)
  // A shared link with filters shows them.
  const active = [
    filters.stage !== "all",
    filters.status !== "all",
    filters.code !== "all",
    filters.gpu !== "all",
    filters.sort !== "rank",
  ].filter(Boolean).length
  const open = opened || active > 0
  // A brand is offered once a project in this view has run on it.
  const gpus = GPUS.filter((g) => entries.some((e) => e.gpus.includes(g)))

  return (
    <>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <RanksTabs ranks={filters.ranks} onChange={(ranks) => set({ ranks })} />
        <search aria-label="Find projects" className="flex w-full gap-2 sm:w-auto">
          <input
            ref={search}
            type="search"
            aria-label="Search projects"
            placeholder="Search projects…"
            value={filters.q}
            maxLength={MAX_QUERY}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => set({ q: e.target.value })}
            className="h-11 w-full min-w-0 rounded-full border border-input bg-(--pane) px-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring sm:h-9 sm:w-56 pointer-fine:text-sm dark:bg-input/30"
          />
          <Button
            variant="outline"
            className="h-11 sm:h-9"
            aria-expanded={open}
            aria-controls="standings-filters"
            onClick={() => setOpened(!open)}
          >
            <SlidersHorizontal aria-hidden="true" /> Filters
          </Button>
        </search>
      </div>

      {open && (
        <fieldset
          id="standings-filters"
          aria-label="Filters"
          className="pane mt-4 grid items-end gap-3 p-4 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap sm:p-5"
        >
          <Field id="standings-stage" label="Stage claimed">
            <NativeSelect
              className="w-full sm:w-fit"
              id="standings-stage"
              value={filters.stage}
              onChange={(e) => set({ stage: e.target.value })}
            >
              <NativeSelectOption value="all">Any stage</NativeSelectOption>
              {STAGES.map((s) => (
                <NativeSelectOption key={s.key} value={s.key}>
                  {s.label} ({count((e) => e.claimedStage === s.key)})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="standings-status" label="Status">
            <NativeSelect
              className="w-full sm:w-fit"
              id="standings-status"
              value={filters.status}
              onChange={(e) => set({ status: e.target.value as Filters["status"] })}
            >
              <NativeSelectOption value="all">Any status</NativeSelectOption>
              {STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {STATUS_LABEL[s]} ({count((e) => e.status === s)})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="standings-gpu" label="Graphics card">
            <NativeSelect
              className="w-full sm:w-fit"
              id="standings-gpu"
              value={filters.gpu}
              onChange={(e) => set({ gpu: e.target.value as Filters["gpu"] })}
            >
              <NativeSelectOption value="all">Any card</NativeSelectOption>
              {gpus.map((g) => (
                <NativeSelectOption key={g} value={g} title={gpuTitle(g)}>
                  {g} ({count((e) => e.gpus.includes(g))})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="standings-sort" label="Sort by">
            <NativeSelect
              className="w-full sm:w-fit"
              id="standings-sort"
              value={filters.sort}
              onChange={(e) => set({ sort: e.target.value as Filters["sort"] })}
            >
              {Object.entries(SORTS).map(([key, label]) => (
                <NativeSelectOption key={key} value={key}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-1">
            <span id="standings-code" className="text-xs text-muted-foreground">
              Code
            </span>
            <ToggleGroup
              aria-labelledby="standings-code"
              variant="outline"
              spacing={0}
              value={[filters.code]}
              onValueChange={(value) => set({ code: (value[0] as Code | undefined) ?? "all" })}
            >
              {CODES.map((c) => (
                <ToggleGroupItem key={c.key} value={c.key}>
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 empty:hidden">
        <p role="status" className="text-sm empty:hidden">
          {!grouped && `${found.length} of ${entries.length} projects`}
        </p>
        {!grouped && (
          <Button variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        )}
      </div>

      {grouped && (
        <div className="mt-4">
          <Race key={filters.ranks} frames={race} stages={stages} />
        </div>
      )}

      <div className="mt-8">
        {grouped ? (
          board
        ) : found.length > 0 ? (
          <ProjectTable label="Matching projects">
            {found.map((e) => (
              <Fragment key={e.id}>{rows[e.id]}</Fragment>
            ))}
          </ProjectTable>
        ) : (
          <Empty className="pane">
            <EmptyHeader>
              <EmptyTitle>No project matches</EmptyTitle>
              <EmptyDescription>Try another name, or fewer filters.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={clear}>
                Show all {entries.length} projects
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </>
  )
}
