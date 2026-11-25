import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function Stars({ count, label }: { count: number; label: string }) {
  return (
    <span role="img" aria-label={`${count} of 5 stars, ${label}`} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          style={{ animationDelay: `${n * 140}ms` }}
          className={cn(
            "size-6 sm:size-8",
            n <= count
              ? "fill-stripe-2 text-stripe-2 [animation-fill-mode:both] motion-safe:animate-in motion-safe:zoom-in-0 motion-safe:spin-in-90 motion-safe:duration-500"
              : "fill-white/10 text-white/35"
          )}
        />
      ))}
    </span>
  )
}
