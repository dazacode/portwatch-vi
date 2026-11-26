"use client"

import { Share2 } from "lucide-react"
import { openShare } from "@/components/share/bus"
import { Button } from "@/components/ui/button"

export function ShareButton() {
  return (
    <Button variant="ghost" size="icon" aria-label="Share this site" onClick={openShare}>
      <Share2 />
    </Button>
  )
}
