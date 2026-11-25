import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function Stars({ count, label }: { count: number; label: string }) {
  return (
    <span role="img" aria-label={`${count} of 5 stars, ${label}`} className="inline-flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          data-star-rating={n <= count ? "" : undefined}
          className={cn(
            "size-8 sm:size-12",
            n <= count ? "fill-stripe-2 text-stripe-2" : "fill-white/10 text-white/35"
          )}
        />
      ))}
    </span>
  )
}
