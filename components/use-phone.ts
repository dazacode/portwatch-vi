"use client"

import { useEffect, useState } from "react"

const PHONE = "(max-width: 47.99rem), (pointer: coarse) and (max-height: 30rem)"

/** False until mounted, so the server and browser agree. */
export function usePhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(PHONE)
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return phone
}
