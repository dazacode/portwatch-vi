"use client"

import { Check, Minus, ScanSearch, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Gpu as BoardGpu } from "@/lib/gpu"
import {
  assess,
  CPUS,
  GPUS,
  type Input,
  MAC_MEMORY,
  MACS,
  type Part,
  PS5_GPU,
  PS5_TFLOPS,
  RAM_SIZES,
  type Result,
  type Status,
  type Storage,
  TIERS,
  type Tier,
  type Warning,
} from "@/lib/pc-check"
import { type Detection, matchRenderer, readRenderer } from "@/lib/pc-check-detect"
import { cn } from "@/lib/utils"

type Kind = "pc" | "mac"

type Choice = {
  kind: Kind
  gpu: string
  cpu: string
  ram: number
  mac: string
  memory: number
  storage: Storage
}

const START: Choice = {
  kind: "pc",
  gpu: "",
  cpu: "",
  ram: 16,
  mac: "",
  memory: 16,
  storage: "nvme",
}

const STORAGE: { key: Storage; label: string }[] = [
  { key: "nvme", label: "NVMe SSD" },
  { key: "sata", label: "SATA SSD" },
  { key: "hdd", label: "Hard drive" },
]

/** The choice lives in the address, so a result can be shared. */
function fromQuery(search: string): Choice {
  const q = new URLSearchParams(search)
  const number = (key: string, allowed: readonly number[], fallback: number) => {
    const n = Number(q.get(key))
    return allowed.includes(n) ? n : fallback
  }
  const known = <T extends { id: string }>(list: T[], id: string | null) =>
    list.some((x) => x.id === id) ? (id as string) : ""
  const storage = STORAGE.find((s) => s.key === q.get("disk"))?.key ?? "nvme"
  const mac = known(MACS, q.get("mac"))
  return {
    kind: mac ? "mac" : "pc",
    gpu: known(GPUS, q.get("gpu")),
    cpu: known(CPUS, q.get("cpu")),
    ram: number("ram", RAM_SIZES, 16),
    mac,
    memory: number("mem", MAC_MEMORY, 16),
    storage,
  }
}

function toQuery(c: Choice) {
  const q = new URLSearchParams()
  if (c.kind === "pc") {
    if (c.gpu) q.set("gpu", c.gpu)
    if (c.cpu) q.set("cpu", c.cpu)
    if (c.ram !== 16) q.set("ram", String(c.ram))
  } else {
    if (c.mac) q.set("mac", c.mac)
    if (c.memory !== 16) q.set("mem", String(c.memory))
  }
  if (c.storage !== "nvme") q.set("disk", c.storage)
  return q.toString()
}

function inputOf(c: Choice): Input | null {
  if (c.kind === "mac") {
    const chip = MACS.find((m) => m.id === c.mac)
    return chip ? { kind: "mac", chip, memory: c.memory, storage: c.storage } : null
  }
  const gpu = GPUS.find((g) => g.id === c.gpu)
  const cpu = CPUS.find((x) => x.id === c.cpu)
  return gpu && cpu ? { kind: "pc", gpu, cpu, ram: c.ram, storage: c.storage } : null
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}

function byBrand<T extends { brand: string }>(list: T[]) {
  const groups = new Map<string, T[]>()
  for (const x of list) groups.set(x.brand, [...(groups.get(x.brand) ?? []), x])
  return [...groups]
}

export function Checker({ builds }: { builds: Record<BoardGpu, number> }) {
  const [choice, setChoice] = useState<Choice>(START)
  const [detected, setDetected] = useState<Detection | null>(null)

  function save(next: Choice) {
    setChoice(next)
    const query = toQuery(next)
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
  }

  function detect(base: Choice) {
    const found = matchRenderer(readRenderer())
    setDetected(found)
    save(withDetection(base, found))
  }

  // A shared link says what to show. Without one, start from the graphics the browser reports.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, with the address the page opened with
  useEffect(() => {
    const opened = fromQuery(window.location.search)
    if (opened.gpu || opened.mac) setChoice(opened)
    else detect(opened)
  }, [])

  function set(patch: Partial<Choice>) {
    // Once the reader picks their own graphics, the note about what was detected no longer applies.
    if ("gpu" in patch || "mac" in patch || "kind" in patch) setDetected(null)
    save({ ...choice, ...patch })
  }

  const input = inputOf(choice)
  const result = input ? assess(input) : null

  return (
    <div className="pane p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <p id="check-kind" className="text-sm font-medium">
          I play on
        </p>
        <ToggleGroup
          aria-labelledby="check-kind"
          variant="outline"
          spacing={0}
          value={[choice.kind]}
          onValueChange={(value) => {
            const kind = value[0] as Kind | undefined
            if (kind) set({ kind })
          }}
        >
          <ToggleGroupItem value="pc">A PC</ToggleGroupItem>
          <ToggleGroupItem value="mac">A Mac</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => detect(choice)}>
          <ScanSearch data-icon="inline-start" aria-hidden="true" />
          Detect my graphics
        </Button>
      </div>
      <div aria-live="polite">{detected && <DetectNote found={detected} />}</div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {choice.kind === "pc" ? (
          <>
            <Field id="check-gpu" label="Graphics card">
              <NativeSelect
                id="check-gpu"
                className="w-full"
                value={choice.gpu}
                onChange={(e) => set({ gpu: e.target.value })}
              >
                <NativeSelectOption value="">Choose your card</NativeSelectOption>
                {byBrand(GPUS).map(([brand, list]) => (
                  <NativeSelectOptGroup key={brand} label={brand}>
                    {list.map((g) => (
                      <NativeSelectOption key={g.id} value={g.id}>
                        {g.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ))}
              </NativeSelect>
            </Field>
            <Field id="check-cpu" label="Processor">
              <NativeSelect
                id="check-cpu"
                className="w-full"
                value={choice.cpu}
                onChange={(e) => set({ cpu: e.target.value })}
              >
                <NativeSelectOption value="">Choose your processor</NativeSelectOption>
                {byBrand(CPUS).map(([brand, list]) => (
                  <NativeSelectOptGroup key={brand} label={brand}>
                    {list.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ))}
              </NativeSelect>
            </Field>
            <Field id="check-ram" label="Memory">
              <NativeSelect
                id="check-ram"
                className="w-full"
                value={String(choice.ram)}
                onChange={(e) => set({ ram: Number(e.target.value) })}
              >
                {RAM_SIZES.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n} GB
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </>
        ) : (
          <>
            <Field id="check-mac" label="Chip">
              <NativeSelect
                id="check-mac"
                className="w-full"
                value={choice.mac}
                onChange={(e) => set({ mac: e.target.value })}
              >
                <NativeSelectOption value="">Choose your chip</NativeSelectOption>
                {MACS.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field id="check-mem" label="Unified memory">
              <NativeSelect
                id="check-mem"
                className="w-full"
                value={String(choice.memory)}
                onChange={(e) => set({ memory: Number(e.target.value) })}
              >
                {MAC_MEMORY.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n} GB
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </>
        )}
        <Field id="check-disk" label="Storage">
          <NativeSelect
            id="check-disk"
            className="w-full"
            value={choice.storage}
            onChange={(e) => set({ storage: e.target.value as Storage })}
          >
            {STORAGE.map((s) => (
              <NativeSelectOption key={s.key} value={s.key}>
                {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div aria-live="polite" className="mt-8">
        {input && result ? (
          <Verdict input={input} result={result} builds={builds} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {choice.kind === "pc"
              ? choice.gpu && !choice.cpu
                ? "Now choose your processor. Browsers can’t read it, so it has to come from you."
                : "Choose a graphics card and a processor to see which console your PC is closest to."
              : "Choose your chip to see which console it is closest to on paper."}
          </p>
        )}
      </div>
    </div>
  )
}

/* ---------- What the browser said ---------- */

/** Fill in what was found. Processor and memory are left as they were: browsers can't read them. */
function withDetection(base: Choice, found: Detection): Choice {
  if (found.kind === "gpu") return { ...base, kind: "pc", gpu: found.gpu }
  if (found.kind === "mac") return { ...base, kind: "mac", mac: found.macs[0] }
  if (found.kind === "hidden" && found.reason === "masked") return { ...base, kind: "mac" }
  if (found.kind === "unlisted" && found.oldMac) return { ...base, kind: "mac" }
  return base
}

const gpuName = (id: string) => GPUS.find((g) => g.id === id)?.name ?? id

function noteText(found: Detection): string {
  switch (found.kind) {
    case "gpu": {
      const parts = [`Your browser draws with an ${found.name}.`]
      if (found.laptop) {
        parts.push(
          "That is a laptop chip, usually slower than the desktop card it is compared with here."
        )
      }
      if (found.others.length > 0) {
        parts.push(
          `We chose the ${gpuName(found.gpu)}; if yours is the ${list(found.others.map(gpuName))}, choose it below.`
        )
      }
      parts.push("Browsers can’t read your processor or memory, so choose those yourself.")
      return parts.join(" ")
    }
    case "mac": {
      const chosen = MACS.find((m) => m.id === found.macs[0])
      return `Your browser runs on an ${found.name}. It can’t tell how many GPU cores yours has, so we chose the ${chosen?.gpuCores}-core version. Check About This Mac, and change it below if yours has more.`
    }
    case "unlisted":
      if (found.oldMac) {
        return `Your browser runs on an ${found.name}. M1 and M2 chips have no ray tracing hardware, which every console version of GTA VI uses, so they aren’t on the list.`
      }
      return found.integrated
        ? `Your browser draws with ${found.name}, built into the processor. That is below an Xbox Series S. If your PC also has a graphics card, choose it below: the browser may not be using it.`
        : `Your browser draws with an ${found.name}, which isn’t on our list. Choose the closest card below.`
    case "hidden":
      switch (found.reason) {
        case "software":
          return "Your browser isn’t drawing with your graphics card, perhaps because hardware acceleration is off, so it can’t tell which one you have. Choose it below."
        case "masked":
          return "Safari doesn’t say which chip it runs on. Choose yours below, or open this page in Chrome or Edge to detect it."
        case "approximate":
          return `Your browser only gives a rough stand-in (${found.name}), so we haven’t used it. Choose your card below.`
        default:
          return "Your browser didn’t say which graphics it uses. Choose yours below."
      }
  }
}

function DetectNote({ found }: { found: Detection }) {
  const matched = found.kind === "gpu" || found.kind === "mac"
  return (
    <div className="mt-4 flex gap-3 rounded-2xl bg-foreground/5 px-4 py-3 text-sm">
      <ScanSearch
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", matched ? "text-primary" : "text-muted-foreground")}
      />
      <p>
        {noteText(found)}{" "}
        <span className="text-muted-foreground">Read in your browser; nothing is sent.</span>
      </p>
    </div>
  )
}

/* ---------- The answer ---------- */

const PART_NAME: Record<Part, string> = {
  gpu: "graphics card",
  cpu: "processor",
  memory: "memory",
}

/** A Mac has a GPU, not a graphics card. */
const partName = (part: Part, kind: Input["kind"]) =>
  kind === "mac" && part === "gpu" ? "GPU" : PART_NAME[part]

/** "a", "a and b", "a, b and c" */
const list = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`

/** The next step, as something to be close to or kept from. */
const goal = (tier: Tier) => (tier.id === "beyond" ? "going past 30 fps (our estimate)" : tier.name)

const percent = (share: number) => `${Math.round(share * 100)}%`

function headline(input: Input, result: Result) {
  const onPaper = input.kind === "mac" ? "On paper, " : ""
  if (result.warnings.includes("no-rt")) return "Probably not"
  if (!result.reached) return `${onPaper}below an Xbox Series S`
  if (result.reached.id === "beyond") return `${onPaper}past a PS5 Pro`
  return `${onPaper}like ${result.reached.name}`
}

function Verdict({
  input,
  result,
  builds,
}: {
  input: Input
  result: Result
  builds: Record<BoardGpu, number>
}) {
  const { reached, near, limit } = result
  const next = TIERS[reached ? TIERS.indexOf(reached) + 1 : 0]
  const title = headline(input, result)
  const noRt = result.warnings.includes("no-rt")
  const brand: BoardGpu = input.kind === "mac" ? "Mac" : input.gpu.brand
  const found = builds[brand] ?? 0

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {noRt ? "Can it run GTA VI?" : "Closest console version"}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-balance text-primary first-letter:uppercase sm:text-5xl">
        {title}
      </p>
      {result.warnings.includes("no-rt") ? (
        <p className="mt-3 max-w-prose">
          Your card has no ray tracing hardware, and every console version lights the city with ray
          tracing. A PC version will very likely need a card that has it.
          {reached && ` On speed alone it is like ${reached.name}.`}
        </p>
      ) : reached ? (
        <p className="mt-3 max-w-prose">
          {reached.id === "beyond"
            ? "About twice a PS5 in both graphics and processor. That is roughly what going past 30 fps would take, if the PC version allows it."
            : `The ${reached.versions} version: ${reached.renders}, shown at ${reached.shown}. ${reached.fps}.`}
        </p>
      ) : null}
      {limit && next && !noRt && (
        <p className="mt-2 max-w-prose text-muted-foreground">
          {near
            ? `Close to ${goal(next)}: your ${partName(limit, input.kind)} is what is short.`
            : `Your ${partName(limit, input.kind)} is what keeps it from ${goal(next)}.`}
        </p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Meter
          label="Graphics"
          detail={
            input.kind === "pc"
              ? input.gpu.name.endsWith("GB")
                ? input.gpu.name
                : `${input.gpu.name}, ${input.gpu.vram} GB`
              : `${input.chip.gpuCores}-core GPU, ${input.chip.tflops} TFLOPS on paper`
          }
          share={result.gpuShare}
          unit="of a PS5"
          max={2.5}
          marks={[
            { label: "Series S", at: TIERS[0].gpu / PS5_GPU },
            { label: "PS5", at: 1 },
            { label: "Pro", at: TIERS[2].gpu / PS5_GPU },
            { label: "2×", at: 2 },
          ]}
        />
        {result.cpuShare !== null && input.kind === "pc" ? (
          <Meter
            label="Processor"
            detail={input.cpu.name}
            share={result.cpuShare}
            unit="of a console"
            max={2}
            marks={[
              { label: "Consoles", at: 1 },
              { label: "2×", at: 1.5 },
            ]}
          />
        ) : (
          <div>
            <p className="text-sm font-medium">Processor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every M3 or newer is ahead of the consoles’ processor in benchmarks. The graphics and
              the missing Mac version are what decide.
            </p>
          </div>
        )}
      </div>

      <ol className="mt-8 divide-y border-y">
        {result.tiers.map(({ tier, status, parts }) => (
          <li key={tier.id} className="grid grid-cols-[1.75rem_1fr] gap-x-2 py-3 text-sm">
            <StatusIcon status={status} />
            <div>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{tier.versions}</span>
                <span className="text-xs text-muted-foreground">
                  {statusText(status, parts, input.kind)}
                </span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {tier.id === "beyond"
                  ? tier.fps
                  : `${tier.renders} shown at ${tier.shown.split(",")[0]}, ${tier.fps.split(",")[0].toLowerCase()}. ${tier.rayTracing}.`}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {result.warnings.filter((w) => w !== "no-rt").length > 0 && (
        <ul className="mt-6 space-y-2 text-sm">
          {result.warnings
            .filter((w) => w !== "no-rt")
            .map((w) => (
              <li key={w} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-step-5"
                />
                <span>{warningText(w, input, result)}</span>
              </li>
            ))}
        </ul>
      )}

      {found > 0 && (
        <p className="mt-6 text-sm">
          <Link
            href={`/standings?gpu=${brand}`}
            className="underline underline-offset-4 hover:text-primary"
          >
            {brand === "Mac"
              ? `${found} fan builds on the board have run on a Mac`
              : `${found} fan builds on the board have run on ${brand} cards`}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            They run far slower than the consoles today.
          </span>
        </p>
      )}
    </div>
  )
}

function statusText(status: Status, parts: Record<Part, Status>, kind: Input["kind"]) {
  if (status === "yes") return "Matches"
  const short = (Object.keys(parts) as Part[]).filter((p) => parts[p] !== "yes")
  const names = list(short.map((p) => partName(p, kind)))
  return status === "close" ? `Close, ${names} a little short` : `Short on ${names}`
}

function StatusIcon({ status }: { status: Status }) {
  const Icon = status === "yes" ? Check : status === "close" ? Minus : X
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 grid size-5 place-items-center rounded-full",
        status === "yes" && "bg-step-6 text-white dark:text-black",
        status === "close" && "bg-step-5 text-white dark:text-black",
        status === "no" && "bg-foreground/10 text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" strokeWidth={3} />
    </span>
  )
}

function Meter({
  label,
  detail,
  share,
  unit,
  max,
  marks,
}: {
  label: string
  detail: string
  share: number
  unit: string
  max: number
  marks: { label: string; at: number }[]
}) {
  const width = Math.min(share / max, 1) * 100
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm">
          <span className="font-semibold tabular-nums">{percent(share)}</span>{" "}
          <span className="text-muted-foreground">{unit}</span>
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      <div
        role="img"
        aria-label={`${label}: ${percent(share)} ${unit}`}
        className="relative mt-2 h-3 rounded-full bg-foreground/10"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
        {marks.map((m) => (
          <span
            key={m.label}
            className="absolute -inset-y-1 w-0.5 bg-foreground/70"
            style={{ left: `${(m.at / max) * 100}%` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="relative mt-1 h-4 text-[0.6875rem] text-muted-foreground">
        {marks.map((m) => (
          <span
            key={m.label}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${(m.at / max) * 100}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function warningText(w: Warning, input: Input, result: Result): string {
  switch (w) {
    case "vram-tight":
      return input.kind === "pc"
        ? `${input.gpu.vram} GB of graphics memory is enough for this step, but tight. The consoles share 16 GB between the game and its graphics, so expect to turn textures down.`
        : ""
    case "ram-low":
      return input.kind === "pc"
        ? "8 GB of memory is less than any console has. Plan on 16 GB at least; many recent open-world PC games ask for 32."
        : "8 GB of unified memory is less than any console has."
    case "hdd":
      return "A hard drive won’t do. Every console streams the city from a fast SSD, and the console versions take 212 to 225 GB."
    case "sata":
      return "A SATA SSD will probably do, though it is slower than the consoles’ NVMe drives."
    case "mac":
      return "There is no Mac version, and no PC version yet to run through a translation layer. These are the chip’s graphics on paper; through a translation layer, expect noticeably less."
    case "estimate":
      return "One of your parts has no benchmark in our sources, so its figure is estimated from its closest relatives."
    case "tflops-overstate":
      return input.kind === "pc"
        ? `On paper this card has ${input.gpu.tflops} TFLOPS, ${(input.gpu.tflops / PS5_TFLOPS).toFixed(1)}× a PS5’s ${PS5_TFLOPS}. In games it is ${percent(result.gpuShare)} of a PS5: TFLOPS don’t compare across generations.`
        : ""
    default:
      return ""
  }
}
