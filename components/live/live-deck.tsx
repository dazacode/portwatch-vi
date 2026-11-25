"use client"

import { ArrowLeft, Radio } from "lucide-react"
import { useEffect, useState } from "react"
import useSWR from "swr"
import { CommitList } from "@/components/broadcast/commit-list"
import { Show } from "@/components/broadcast/show"
import { useSound } from "@/components/broadcast/use-sound"
import { Container } from "@/components/container"
import { ChannelList } from "@/components/live/channel-list"
import { Stage } from "@/components/live/stage"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { Broadcast } from "@/lib/broadcast"
import { channelKey, type Snapshot, type Stream } from "@/lib/live/types"
import { TRAILERS } from "@/lib/trailers"

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

const REFRESH = { refreshInterval: 20_000, keepPreviousData: true }

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
  answer,
}: {
  initial: Snapshot
  broadcast: Broadcast
  projects: Record<string, string>
  answer: string
}) {
  const live = useSWR<Snapshot>("/api/live", fetcher, { ...REFRESH, fallbackData: initial })
  const show = useSWR<Broadcast>("/api/broadcast", fetcher, { ...REFRESH, fallbackData: broadcast })
  const snapshot = live.data ?? initial
  const onAir = show.data ?? broadcast
  const [watched, setWatched] = useWatched()
  // A click is a request to play. A shared link is not.
  const [clicked, setClicked] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const current = [...snapshot.streams, ...TRAILERS].find((s) => s.id === watched) ?? null
  const sound = useSound(current === null)

  const watch = (id: string | null) => {
    setClicked(id !== null)
    setWatched(id)
    setDrawer(false)
    window.scrollTo({ top: 0 })
  }
  const channels = (
    <ChannelList
      snapshot={snapshot}
      projects={projects}
      currentId={current?.id ?? null}
      onWatch={watch}
      stale={Boolean(live.error)}
    />
  )
  const openDrawer = (
    <Button
      variant="ghost"
      size="lg"
      className="bg-black/50 text-white hover:bg-black/80 hover:text-white dark:hover:bg-black/80"
      onClick={() => setDrawer(true)}
    >
      <Radio /> {snapshot.streams.length} live
    </Button>
  )

  return (
    <>
      {current ? (
        <Stage
          key={current.id}
          stream={current}
          at={snapshot.at}
          autoPlay={clicked}
          about={about(current, snapshot, projects)}
          actions={
            <>
              <Button size="lg" onClick={() => watch(null)}>
                <ArrowLeft /> Back to the show
              </Button>
              {openDrawer}
            </>
          }
        />
      ) : (
        <Show
          broadcast={onAir}
          streams={snapshot.streams}
          answer={answer}
          sound={sound}
          channels={openDrawer}
          onWatch={watch}
        />
      )}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Live channels</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{channels}</div>
        </SheetContent>
      </Sheet>
      <Container className="mt-2 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <CommitList commits={onAir.commits} at={onAir.at} />
        <div className="pt-6">{channels}</div>
      </Container>
    </>
  )
}
