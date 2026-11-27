"use client"

import { X } from "lucide-react"
import { PROMO, PROMO_KEY } from "@/lib/promo"

export function PromoClose() {
  return (
    <button
      type="button"
      aria-label={`Close the ${PROMO.name} banner`}
      className="absolute right-[max(0.25rem,env(safe-area-inset-right))] grid size-9 place-items-center rounded-full opacity-80 outline-none hover:bg-background/15 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        document.documentElement.dataset.promo = "closed"
        try {
          localStorage.setItem(PROMO_KEY, PROMO.id)
        } catch {}
      }}
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  )
}
