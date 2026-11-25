import { Podium } from "@/components/standings/podium"
import { ProjectCard } from "@/components/standings/project-card"
import { ProjectRow } from "@/components/standings/project-row"
import { ProjectTable } from "@/components/standings/project-table"
import { groupProjects, INACTIVE_DAYS, type Project } from "@/lib/standings"

function Group({
  id,
  title,
  note,
  children,
}: {
  id: string
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <h2 id={id} className="mb-3 text-lg font-semibold">
        {title}
      </h2>
      {note && <p className="-mt-2 mb-3 text-sm text-muted-foreground">{note}</p>}
      {children}
    </section>
  )
}

export function Board({ projects }: { projects: Project[] }) {
  const { podium, top5, top10, rest, private: closed, gone } = groupProjects(projects)
  const later = projects.filter((p) => p.status === "private" && p.publicLater).map((p) => p.name)
  const table = (label: string, rows: Project[], strong = false) => (
    <ProjectTable label={label}>
      {rows.map((p) => (
        <ProjectRow key={p.id} project={p} strong={strong} />
      ))}
    </ProjectTable>
  )
  const promise = later.length > 0 && (
    <p className="mt-3 max-w-prose text-sm text-muted-foreground">
      {later.length > 1
        ? `${later.slice(0, -1).join(", ")} and ${later.at(-1)} say`
        : `${later[0]} says`}{" "}
      the code will be published once the build is out.
    </p>
  )
  return (
    <>
      {podium.length > 0 && (
        <Group id="top-3" title="Top 3">
          <Podium projects={podium} />
        </Group>
      )}
      {top5.length > 0 && (
        <Group id="top-5" title="4 and 5">
          <ol className="grid gap-4 md:grid-cols-2">
            {top5.map((p) => (
              <li key={p.id} className="flex">
                <ProjectCard project={p} className="pane flex-1" />
              </li>
            ))}
          </ol>
        </Group>
      )}
      {top10.length > 0 && (
        <Group id="top-10" title="6 to 10">
          {table("Ranks 6 to 10", top10, true)}
        </Group>
      )}
      {rest.length > 0 && (
        <Group id="rest" title="The rest">
          {table("Rank 11 and below", rest)}
        </Group>
      )}
      {closed.length > 0 && (
        <Group id="private" title="Private builds" note="Not ranked: their code isn’t public.">
          {table("Private builds", closed)}
          {promise}
        </Group>
      )}
      {/* Without a group of their own, the promise follows the ranks. */}
      {closed.length === 0 && promise}
      <Group
        id="gone"
        title="Offline or inactive"
        note={`Taken down, unreachable, archived, or no code for ${INACTIVE_DAYS} days.`}
      >
        {gone.length > 0 ? (
          table("Offline or inactive", gone)
        ) : (
          <p className="text-sm">None right now.</p>
        )}
      </Group>
    </>
  )
}
