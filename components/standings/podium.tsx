import { ProjectCard } from "@/components/standings/project-card"
import type { Project } from "@/lib/standings"
import { cn } from "@/lib/utils"

// Read 1, 2, 3 everywhere. On wide screens 1 stands in the middle, on the tallest block: the offset
// above a place and the height of its block always add up, so the three cards stay the same height.
const PLACES = [
  { item: "lg:order-2", block: "lg:h-28" },
  { item: "lg:order-1 lg:pt-10", block: "lg:h-18" },
  { item: "lg:order-3 lg:pt-16", block: "lg:h-12" },
]

export function Podium({ projects }: { projects: Project[] }) {
  return (
    <ol className="grid gap-4 lg:grid-cols-3">
      {projects.map((p, i) => (
        <li
          key={p.id}
          className={cn("flex flex-col", PLACES[i].item)}
          style={{ "--mark": `var(--stripe-${i + 1})` } as React.CSSProperties}
        >
          <ProjectCard project={p} large className="pane flex-1 lg:rounded-b-none lg:border-b-0" />
          <div
            aria-hidden="true"
            className={cn(
              "hidden place-items-center rounded-b-3xl bg-(--mark) text-4xl font-extrabold text-black lg:grid",
              PLACES[i].block
            )}
          >
            {i + 1}
          </div>
        </li>
      ))}
    </ol>
  )
}
