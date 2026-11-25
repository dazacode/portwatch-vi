"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// Enough scrolling to mean it.
const SCROLLED = 24

/** Sticky everywhere. On the home page it waits off screen until the page is scrolled or tabbed to. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const home = usePathname() === "/"
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    // On a phone the feed fills the screen, so the header waits for the end of it.
    const sync = () => {
      const feed = document.documentElement.classList.contains("feed")
      const end = feed ? document.getElementById("feed-end") : null
      setScrolled(
        end ? end.getBoundingClientRect().top < window.innerHeight / 2 : window.scrollY > SCROLLED
      )
    }
    sync()
    window.addEventListener("scroll", sync, { passive: true })
    return () => window.removeEventListener("scroll", sync)
  }, [])
  return (
    <header
      className={cn(
        "top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto w-[calc(100%-1.5rem)] max-w-[79rem] transition-[translate] duration-300 ease-out motion-reduce:transition-none",
        home ? "fixed inset-x-0" : "sticky mt-3",
        home && !scrolled && "-translate-y-[200%] focus-within:translate-y-0"
      )}
    >
      <div
        className={cn(
          "glass overflow-hidden rounded-3xl md:rounded-full",
          // Light glass is too thin for the links when dark footage is behind it.
          home && "[html:not(.dark)_&]:[--glass:oklch(1_0_0/86%)]"
        )}
      >
        {children}
      </div>
    </header>
  )
}
