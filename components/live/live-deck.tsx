"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { ChannelList } from "@/components/live/channel-list"
import { Stage } from "@/components/live/stage"
import { channelKey, type Snapshot, type Stream } from "@/lib/live/types"

const fetcher = async (url: string): Promise<Snapshot> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Live data answered ${res.status}`)
  return res.json()
}

/** Reads and writes ?watch=, so a link opens on the same stream. */
function useWatched() {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("watch"))
  }, [])
  const watch = (next: string) => {
    setId(next)
    const url = new URL(window.location.href)
    url.searchParams.set("watch", next)
    window.history.replaceState(window.history.state, "", url)
  }
  return [id, watch] as const
}

/** A channel's own note wins: the person streaming is not always the developer. */
function about(stream: Stream, snapshot: Snapshot, projects: Record<string, string>) {
  const channel = snapshot.channels.find((c) => channelKey(c) === channelKey(stream))
  if (channel?.note) return channel.note
  const project = stream.effortId ? projects[stream.effortId] : undefined
  return project && project !== stream.name ? `Working on ${project}` : undefined
}

export function LiveDeck({
  initial,
  projects,
}: {
  initial: Snapshot
  projects: Record<string, string>
}) {
  const { data, error } = useSWR("/api/live", fetcher, {
    fallbackData: initial,
    refreshInterval: 45_000,
    keepPreviousData: true,
  })
  const snapshot = data ?? initial
  const [watched, watch] = useWatched()
  const current = snapshot.streams.find((s) => s.id === watched) ?? snapshot.streams[0] ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
      <Stage
        key={current?.id ?? "none"}
        stream={current}
        at={snapshot.at}
        about={current ? about(current, snapshot, projects) : undefined}
      />
      <ChannelList
        snapshot={snapshot}
        projects={projects}
        currentId={current?.id ?? null}
        onWatch={watch}
        stale={Boolean(error)}
      />
    </div>
  )
}
