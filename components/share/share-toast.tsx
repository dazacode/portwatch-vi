"use client"

import { Share2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { openShare } from "@/components/share/bus"
import { Button } from "@/components/ui/button"
import { usePath } from "@/components/use-path"
import { cn } from "@/lib/utils"

const KEY = "share-asked"
/** Long enough to have seen what the site is. */
const AFTER = 15_000
const RETRY = 5_000
/** It goes by itself if nobody answers. */
const FOR = 30_000

/** Asked once, on someone's first visit: would they pass the site on? */
export function ShareToast() {
  const [shown, setShown] = useState(false)
  // The home page has its controls at the bottom and no header at the top; other pages the other way round.
  const home = usePath() === "/"

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return
    } catch {
      return
    }
    let timer = 0
    let hide = 0
    const busy = () =>
      document.hidden ||
      document.documentElement.dataset.splash !== undefined ||
      document.querySelector("[data-board-notice][data-showing]") !== null ||
      document.querySelector("[data-slot=sheet-content]") !== null
    const tryShow = () => {
      if (busy()) {
        timer = window.setTimeout(tryShow, RETRY)
        return
      }
      try {
        localStorage.setItem(KEY, new Date().toISOString())
      } catch {}
      setShown(true)
      hide = window.setTimeout(() => setShown(false), FOR)
    }
    timer = window.setTimeout(tryShow, AFTER)
    return () => {
      clearTimeout(timer)
      clearTimeout(hide)
    }
  }, [])

  if (!shown) return null
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed inset-x-3 z-30 flex justify-center lg:inset-x-auto lg:left-6",
        home
          ? "top-[max(0.75rem,env(safe-area-inset-top))] lg:top-6"
          : "bottom-[max(0.75rem,env(safe-area-inset-bottom))] lg:bottom-6"
      )}
    >
      <div className="glass pointer-events-auto flex max-w-sm items-center gap-3 rounded-4xl py-2 pr-2 pl-4 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 lg:motion-safe:slide-in-from-bottom-2">
        <Share2 aria-hidden="true" className="size-5 shrink-0 text-stripe-1" />
        <p className="min-w-0">
          <span className="block font-semibold">New here? Share the race</span>
          <span className="block text-xs">with a friend waiting for GTA VI.</span>
        </p>
        <Button
          className="shrink-0"
          onClick={() => {
            setShown(false)
            openShare()
          }}
        >
          Share
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0"
          aria-label="Close"
          onClick={() => setShown(false)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
