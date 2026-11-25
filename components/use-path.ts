"use client"

import { usePathname } from "next/navigation"

/** The path of the page. On Vercel a regenerated home page is told it is at /index. */
export function usePath() {
  const path = usePathname()
  return path === "/index" ? "/" : path
}
