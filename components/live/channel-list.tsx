import { compact, plainTitle, utcTime } from "@/lib/format"
import { isBoard } from "@/lib/live/filter"
import {
  type ChannelStatus,
  channelKey,
  PLATFORM_LABEL,
  PLATFORMS,
  type Snapshot,
  type Stream,
} from "@/lib/live/types"
import { cn } from "@/lib/utils"

const channelUrl = (c: ChannelStatus) =>
  ({
    twitch: `https://www.twitch.tv/${c.handle}`,
    youtube: `https://www.youtube.com/${c.handle.startsWith("UC") ? `channel/${c.handle}` : c.handle}`,
    kick: `https://kick.com/${c.handle}`,
    rumble: `https://rumble.com/${c.handle}`,
  })[c.platform]

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="border-b pb-1.5 text-sm font-medium">{title}</h2>
      <ul>{children}</ul>
    </div>
  )
}

function StreamRow({
  stream,
  current,
  onWatch,
}: {
  stream: Stream
  current: boolean
  onWatch: (id: string) => void
}) {
  return (
    <li className="border-b">
      <button
        type="button"
        aria-pressed={current}
        onClick={() => onWatch(stream.id)}
        className={cn(
          "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 px-2 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
          current && "bg-muted"
        )}
      >
        <span aria-hidden className="size-2 self-center rounded-full bg-live" />
        <span className="truncate text-sm font-medium">{stream.name}</span>
        <span className="text-xs text-muted-foreground">
          {stream.viewers === null
            ? PLATFORM_LABEL[stream.platform]
            : `${PLATFORM_LABEL[stream.platform]}, ${compact(stream.viewers)}`}
        </span>
        <span className="col-start-2 col-end-4 truncate text-xs text-muted-foreground">
          {plainTitle(stream.title)}
        </span>
      </button>
    </li>
  )
}

export function ChannelList({
  snapshot,
  projects,
  currentId,
  onWatch,
  stale,
}: {
  snapshot: Snapshot
  projects: Record<string, string>
  currentId: string | null
  onWatch: (id: string) => void
  stale: boolean
}) {
  const tracked = snapshot.streams.filter((s) => s.origin === "tracked")
  const search = snapshot.streams.filter((s) => s.origin === "search")
  const found = search.filter((s) => !isBoard(s.title))
  const boards = search.filter((s) => isBoard(s.title))
  const idle = snapshot.channels.filter((c) => !c.live)
  const failed = PLATFORMS.filter((p) => snapshot.sources[p] === "error")
  const searched = PLATFORMS.filter((p) => snapshot.sources[p] === "ok")
  const names = (list: readonly (typeof PLATFORMS)[number][]) =>
    new Intl.ListFormat("en").format(list.map((p) => PLATFORM_LABEL[p]))

  return (
    <aside aria-label="Channels" className="space-y-6">
      {tracked.length > 0 && (
        <Group title="Live now">
          {tracked.map((s) => (
            <StreamRow key={s.id} stream={s} current={s.id === currentId} onWatch={onWatch} />
          ))}
        </Group>
      )}
      {found.length > 0 && (
        <Group title="Also streaming">
          {found.slice(0, 12).map((s) => (
            <StreamRow key={s.id} stream={s} current={s.id === currentId} onWatch={onWatch} />
          ))}
        </Group>
      )}
      {boards.length > 0 && (
        <Group title="24/7 progress boards">
          {boards.slice(0, 3).map((s) => (
            <StreamRow key={s.id} stream={s} current={s.id === currentId} onWatch={onWatch} />
          ))}
        </Group>
      )}
      {idle.length > 0 && (
        <Group title="Not live">
          {idle.map((c) => (
            <li key={channelKey(c)} className="border-b">
              <a
                href={channelUrl(c)}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline gap-2.5 px-2 py-2 text-sm hover:bg-muted"
              >
                <span className="truncate">{c.name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {c.note ??
                    (c.effortId && projects[c.effortId] !== c.name ? projects[c.effortId] : null)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {PLATFORM_LABEL[c.platform]}
                  {c.live === null ? ", not known" : ""}
                </span>
              </a>
            </li>
          ))}
        </Group>
      )}
      <p className="text-xs text-muted-foreground">
        {stale ? "Can’t refresh right now. Last checked" : "Checked"} {utcTime(snapshot.at)}
        {searched.length > 0 && ` on ${names(searched)}`}.
        {failed.length > 0 && ` ${names(failed)} didn’t answer.`}
      </p>
    </aside>
  )
}
