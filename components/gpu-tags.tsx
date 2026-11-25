import { type Gpu, gpuTitle } from "@/lib/gpu"
import { cn } from "@/lib/utils"

// Outlined, so they read apart from the filled status labels. The same colours as upstream's tags.
const COLOR: Record<Gpu, string> = {
  AMD: "text-[#c8102e] dark:text-[#ff7b7b]",
  NVIDIA: "text-[#4a7a00] dark:text-[#a3d94a]",
  Intel: "text-[#0a5fb4] dark:text-[#6cb6ff]",
  Mac: "text-[#4b5160] dark:text-[#c9ced8]",
}

/** The graphics cards a build has run on. Nothing when nobody has said. */
export function GpuTags({ gpus, className }: { gpus: Gpu[]; className?: string }) {
  if (gpus.length === 0) return null
  return (
    <span className={cn("inline-flex flex-wrap gap-1 align-middle", className)}>
      {gpus.map((g) => (
        <span
          key={g}
          title={gpuTitle(g)}
          className={cn(
            "inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-bold tracking-wide ring-[1.5px] ring-current ring-inset",
            COLOR[g]
          )}
        >
          <span className="sr-only">{gpuTitle(g)}: </span>
          <span aria-hidden="true">{g}</span>
        </span>
      ))}
    </span>
  )
}
