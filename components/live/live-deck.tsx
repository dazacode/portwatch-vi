"use client"

import { ArrowLeft, Radio, Timer } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Backdrop } from "@/components/backdrop"
import { CommitList } from "@/components/broadcast/commit-list"
import { useSound } from "@/components/broadcast/use-sound"
import { Container } from "@/components/container"
import { ChannelList } from "@/components/live/channel-list"
import { Opening, type Panel } from "@/components/opening/opening"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useIdle } from "@/components/use-idle"
import { usePhone } from "@/components/use-phone"
import type { Broadcast } from "@/lib/broadcast"
import { channelKey, type Snapshot, type Stream } from "@/lib/live/types"
import type { Verdict } from "@/lib/tracker"
import { TRAILERS } from "@/lib/trailers"
import { scrollBehavior } from "@/lib/utils"

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

// Neither is on the first screen, so neither is in the first download.
const blank = () => <div className="stage-height bg-black" />
const Show = dynamic(() => import("@/components/broadcast/show").then((m) => m.Show), {
  loading: blank,
})
const Feed = dynamic(() => import("@/components/broadcast/feed").then((m) => m.Feed), {
  ssr: false,
})
const Stage = dynamic(() => import("@/components/live/stage").then((m) => m.Stage), {
  loading: blank,
})

const REFRESH = { refreshInterval: 20_000, keepPreviousData: true }

function writeParam(key: string, value: string | null) {
  const url = new URL(window.location.href)
  if (value) url.searchParams.set(key, value)
  else url.searchParams.delete(key)
  window.history.replaceState(window.history.state, "", url)
}

/** Reads and writes ?watch=, ?view=show and ?panel=, so a link opens on the same thing. ?view=all is the plain page on a phone. */
function useView() {
  const [watched, setWatched] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const [all, setAll] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setWatched(params.get("watch"))
    setShow(params.get("view") === "show")
    setAll(params.get("view") === "all")
    const open = params.get("panel")
    if (open === "leaders" || open === "commits") setPanel(open)
  }, [])
  return {
    watched,
    show,
    all,
    openAll: (open: boolean) => {
      setAll(open)
      setShow(false)
      writeParam("view", open ? "all" : null)
    },
    panel,
    openPanel: (next: Panel | null) => {
      setPanel(next)
      writeParam("panel", next)
    },
    watch: (id: string | null) => {
      setWatched(id)
      writeParam("watch", id)
    },
    openShow: (open: boolean) => {
      setShow(open)
      writeParam("view", open ? "show" : null)
    },
  }
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
  verdict,
}: {
  initial: Snapshot
  broadcast: Broadcast
  projects: Record<string, string>
  answer: string
  verdict: Verdict
}) {
  const live = useSWR<Snapshot>("/api/live", fetcher, { ...REFRESH, fallbackData: initial })
  const show = useSWR<Broadcast>("/api/broadcast", fetcher, { ...REFRESH, fallbackData: broadcast })
  const snapshot = live.data ?? initial
  const onAir = show.data ?? broadcast
  const view = useView()
  // A click is a request to play. A shared link is not.
  const [clicked, setClicked] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [still, setStill] = useState(false)
  const [page, setPage] = useState(0)
  const phone = usePhone()
  const idle = useIdle()
  const first = useRef<HTMLDivElement>(null)
  const current = [...snapshot.streams, ...TRAILERS].find((s) => s.id === view.watched) ?? null
  const sound = useSound(current === null)

  const watch = (id: string | null) => {
    setClicked(id !== null)
    view.watch(id)
    setDrawer(false)
    window.scrollTo({ top: 0 })
  }
  // The opening has its own commit feed, so the channels get the full width below it.
  const opening = current === null && (phone || !view.show)
  const channelList = (wide: boolean) => (
    <ChannelList
      wide={wide}
      snapshot={snapshot}
      projects={projects}
      currentId={current?.id ?? null}
      onWatch={watch}
      stale={Boolean(live.error)}
    />
  )
  const swiping = phone && current === null && !view.all
  useEffect(() => {
    if (!swiping) return
    document.documentElement.classList.add("feed")
    return () => document.documentElement.classList.remove("feed")
  }, [swiping])

  // Straight to the page itself, for someone who would rather read than swipe.
  const jump = useRef<"rest" | "feed" | null>(null)
  const openAll = (open: boolean) => {
    jump.current = open ? "rest" : "feed"
    view.openAll(open)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: after the feed has come or gone
  useEffect(() => {
    const to = jump.current
    jump.current = null
    if (to === "rest")
      document.getElementById("feed-end")?.scrollIntoView({ behavior: scrollBehavior() })
    else if (to === "feed") first.current?.scrollIntoView({ behavior: scrollBehavior() })
  }, [view.all])

  const openShow = (open: boolean) => {
    view.openShow(open)
    window.scrollTo({ top: 0 })
  }
  const glass = "glass text-white hover:bg-white/20 hover:text-white dark:hover:bg-white/20"
  const openDrawer = (
    <Button variant="ghost" size="lg" className={glass} onClick={() => setDrawer(true)}>
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
                <ArrowLeft />{" "}
                {phone ? "Back" : view.show ? "Back to the show" : "Back to the countdown"}
              </Button>
              {openDrawer}
            </>
          }
        />
      ) : view.show && !phone ? (
        <Show
          broadcast={onAir}
          streams={snapshot.streams}
          answer={answer}
          sound={sound}
          channels={
            <>
              {openDrawer}
              <Button variant="ghost" size="lg" className={glass} onClick={() => openShow(false)}>
                <Timer /> Countdown
              </Button>
            </>
          }
          onWatch={watch}
        />
      ) : (
        <div className="dark relative isolate bg-black text-white">
          <div className="absolute inset-0 -z-10">
            <div className="sticky top-0 h-lvh">
              <Backdrop paused={still} clip={swiping ? page : undefined} />
            </div>
          </div>
          <Opening
            broadcast={onAir}
            verdict={verdict}
            sound={sound}
            panel={view.panel}
            onPanel={view.openPanel}
            onShow={() => openShow(true)}
            still={still}
            onStill={setStill}
            phone={phone ? { all: view.all, onAll: openAll } : null}
          />
          <div ref={first}>
            {swiping && idle && (
              <Feed
                broadcast={onAir}
                streams={snapshot.streams}
                sound={sound}
                start={page || (view.show ? 1 : 0)}
                onPage={setPage}
                onWatch={watch}
                onChannels={() => setDrawer(true)}
                onAll={() => openAll(true)}
              />
            )}
          </div>
        </div>
      )}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Live channels</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{channelList(false)}</div>
        </SheetContent>
      </Sheet>
      {opening ? (
        <div id="feed-end" className="feed-rest">
          <Container className="pt-10 [.feed_&]:pt-32">{channelList(true)}</Container>
        </div>
      ) : (
        <Container className="mt-2 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <CommitList commits={onAir.commits} at={onAir.at} />
          <div className="pt-6">{channelList(false)}</div>
        </Container>
      )}
    </>
  )
}
