import { ArrowUpRight } from "lucide-react"
import { PromoClose } from "@/components/promo-close"
import { PROMO } from "@/lib/promo"

/** Sticky above the header on every page, until the visitor closes it. */
export function PromoBanner() {
  if (!PROMO.on) return null
  return (
    <aside
      id="promo"
      aria-label="From the VIPortLive team"
      className="sticky top-0 z-50 bg-foreground pt-[env(safe-area-inset-top)] text-background"
    >
      <div className="relative flex h-10 items-center justify-center pr-[max(2.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] text-sm sm:pl-11">
        <a
          href={PROMO.href}
          target="_blank"
          rel="noreferrer"
          className="group flex min-w-0 items-center gap-2 rounded-full px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-primary-foreground uppercase">
            New
          </span>
          <span className="min-w-0 truncate">
            <strong translate="no" className="font-semibold">
              {PROMO.name}:
            </strong>{" "}
            <span className="opacity-80">
              <span className="sm:hidden">{PROMO.short}</span>
              <span className="max-sm:hidden">{PROMO.pitch}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 font-semibold underline-offset-4 group-hover:underline max-sm:sr-only">
            {PROMO.cta}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 sm:hidden" />
        </a>
        <PromoClose />
      </div>
      {/* The site's three stripes, as a seam under the strip. */}
      <div
        aria-hidden="true"
        className="h-0.5 bg-linear-to-r from-stripe-1 via-stripe-2 to-stripe-3"
      />
    </aside>
  )
}
