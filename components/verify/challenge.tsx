"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { buttonVariants } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Issued = { stage: string; code: string; actions: string[]; endsAt: string }

async function fetcher(url: string): Promise<Issued> {
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error)
  return body
}

function useSecondsUntil(iso: string | undefined) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!iso) return
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [iso])
  return left
}

export function Challenge({
  projects,
  issues,
}: {
  projects: { id: string; name: string }[]
  issues: string
}) {
  const [id, setId] = useState("")
  const { data, error, mutate } = useSWR(id ? `/api/challenge/${id}` : null, fetcher, {
    revalidateOnFocus: false,
  })
  const left = useSecondsUntil(data?.endsAt)
  useEffect(() => {
    if (left === 0) void mutate()
  }, [left, mutate])
  const submit = data
    ? `${issues}/new?${new URLSearchParams({
        template: "challenge.yml",
        title: `Challenge: ${projects.find((p) => p.id === id)?.name}`,
        project: id,
        code: data.code,
      })}`
    : ""

  return (
    <div className="border p-4 sm:p-6">
      <label htmlFor="project" className="text-sm font-medium">
        Project
      </label>
      <NativeSelect
        id="project"
        className="mt-1.5 w-full sm:w-72"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <NativeSelectOption value="">Choose a project</NativeSelectOption>
        {projects.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <div aria-live="polite">
        {error && <p className="mt-4 text-sm text-destructive">{error.message}.</p>}
        {data && !error && (
          <div className="mt-6">
            <p className="text-4xl font-extrabold tracking-tight text-primary sm:text-6xl">
              {data.code}
            </p>
            <ol className="mt-4 list-decimal space-y-1 pl-5">
              {data.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
            <a
              href={submit}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "lg", className: "mt-5" })}
            >
              Submit the recording
            </a>
          </div>
        )}
      </div>
      {data && !error && left !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          New code and actions in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
      )}
    </div>
  )
}
