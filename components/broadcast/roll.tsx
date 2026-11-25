"use client"

import NumberFlow from "@number-flow/react"
import { useEffect, useState } from "react"

/** A number that rolls to its value when it appears. */
export function Roll({
  from,
  to,
  prefix,
  suffix,
}: {
  from: number
  to: number
  prefix?: string
  suffix?: string
}) {
  const [value, setValue] = useState(from)
  useEffect(() => {
    const timer = setTimeout(() => setValue(to), 500)
    return () => clearTimeout(timer)
  }, [to])
  return <NumberFlow value={value} prefix={prefix} suffix={suffix} />
}
