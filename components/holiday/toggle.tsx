"use client"

import { Leaf } from "lucide-react"
import { useHoliday } from "@/components/holiday/use-holiday"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Only there while it is a holiday. */
export function HolidayToggle({
  greet = false,
  size = "icon",
  className,
}: {
  /** Says the greeting next to the leaf, where there is room. */
  greet?: boolean
  size?: "icon" | "icon-lg"
  className?: string
}) {
  const { holiday, on, toggle } = useHoliday()
  if (!holiday) return null
  return (
    <Button
      variant="ghost"
      size={size}
      aria-pressed={on}
      aria-label={`${holiday.name} theme`}
      title={`Turn the ${holiday.name} theme ${on ? "off" : "on"}`}
      className={cn(greet && "2xl:w-auto 2xl:gap-2 2xl:px-4", className)}
      onClick={toggle}
    >
      <Leaf aria-hidden="true" className={cn(on ? "fill-current text-primary" : "opacity-70")} />
      {greet && (
        <span className="max-2xl:hidden">{on ? holiday.greeting : `${holiday.name} theme`}</span>
      )}
    </Button>
  )
}
