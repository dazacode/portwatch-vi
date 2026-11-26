"use client"

import { Check, Link2 } from "lucide-react"
import { useState } from "react"

export function Share({ title }: { title: string }) {
  const [done, setDone] = useState(false)
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      // A cancelled share sheet needs no message.
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {done ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
      {done ? "Copied" : "Share"}
    </button>
  )
}
