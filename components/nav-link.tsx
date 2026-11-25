"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function NavLink({ href, label }: { href: string; label: string }) {
  const active = usePathname() === href
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "py-1 text-muted-foreground hover:text-foreground",
        active && "font-medium text-foreground"
      )}
    >
      {label}
    </Link>
  )
}
