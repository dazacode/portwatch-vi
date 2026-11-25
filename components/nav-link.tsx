"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { usePath } from "@/components/use-path"
import { cn } from "@/lib/utils"

export function NavLink({ href, label }: { href: string; label: string }) {
  const active = usePath() === href
  const ref = useRef<HTMLAnchorElement>(null)
  // On a narrow phone the row scrolls, so the current page is brought into it.
  useEffect(() => {
    const row = ref.current?.parentElement
    if (active && row && ref.current) {
      row.scrollLeft = ref.current.offsetLeft - (row.clientWidth - ref.current.offsetWidth) / 2
    }
  }, [active])
  return (
    <Link
      ref={ref}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 shrink-0 items-center rounded-full px-2 text-[0.8125rem] text-muted-foreground md:text-sm transition-colors hover:bg-foreground/8 hover:text-foreground md:min-h-9 md:px-3.5",
        active && "bg-foreground/12 font-medium text-foreground"
      )}
    >
      {label}
    </Link>
  )
}
