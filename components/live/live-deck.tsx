"use client"

import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { CommitList } from "@/components/broadcast/commit-list"
import { Show } from "@/components/broadcast/show"
import { ChannelList } from "@/components/live/channel-list"
import { Stage } from "@/components/live/stage"
import { Button } from "@/components/ui/button"
import type { Broadcast } from "@/lib/broadcast"
import { channelKey, type Snapshot, type Stream } from "@/lib/live/types"

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

const REFRESH = { refreshInterval: 45_000, keepPreviousData: true }

/** Reads and writes ?watch=, so a link opens on the same stream. Null means the show is on. */
function useWatched() {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("watch"))
  }, [])
  const watch = (next: string | null) => {
    setId(next)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set("watch", next)
    else url.searchParams.delete("watch")
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
  broadcast,
  projects,
}: {
  initial: Snapshot
  broadcast: Broadcast
  projects: Record<string, string>
}) {
  const live = useSWR<Snapshot>("/api/live", fetcher, { ...REFRESH, fallbackData: initial })
  const show = useSWR<Broadcast>("/api/broadcast", fetcher, { ...REFRESH, fallbackData: broadcast })
  const snapshot = live.data ?? initial
  const onAir = show.data ?? broadcast
  const [watched, setWatched] = useWatched()
  // A click is a request to play. A shared link is not.
  const [clicked, setClicked] = useState(false)
  const watch = (id: string | null) => {
    setClicked(id !== null)
    setWatched(id)
  }
  const current = snapshot.streams.find((s) => s.id === watched) ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
      <div className="min-w-0">
        {current ? (
          <>
            <Button variant="ghost" size="sm" className="mb-2" onClick={() => watch(null)}>
              <ArrowLeft /> Back to the show
            </Button>
            <Stage
              key={current.id}
              stream={current}
              at={snapshot.at}
              autoPlay={clicked}
              about={about(current, snapshot, projects)}
            />
          </>
        ) : (
          <Show broadcast={onAir} streams={snapshot.streams} onWatch={watch} />
        )}
        <CommitList commits={onAir.commits} at={onAir.at} />
      </div>
      <ChannelList
        snapshot={snapshot}
        projects={projects}
        currentId={current?.id ?? null}
        onWatch={watch}
        stale={Boolean(live.error)}
      />
    </div>
  )
}
