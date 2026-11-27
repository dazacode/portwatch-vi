import { cn } from "@/lib/utils"

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      translate="no"
      dir="ltr"
      className={cn("inline-flex items-baseline text-xl leading-none", className)}
    >
      <span className="font-extrabold tracking-tight">VIPort</span>
      <span className="ml-0.5 font-script text-[1.3em] text-primary">Live</span>
    </span>
  )
}
