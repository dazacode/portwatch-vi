"use client"

import { useEffect, useRef, useState } from "react"
import { useIdle } from "@/components/use-idle"
import { CLIPS, POSTERS } from "@/lib/footage"
import { cn } from "@/lib/utils"

// How long before its end a clip starts to give way to the next.
const FADE = 1.2
// How long before that the next one is fetched.
const AHEAD = 8

/** Someone who asked for less motion or less data gets the still. */
function useAllowed() {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const update = () => setAllowed(!motion.matches && !saving?.saveData)
    update()
    motion.addEventListener("change", update)
    return () => motion.removeEventListener("change", update)
  }, [])
  return allowed
}

/**
 * Miami, one clip after another. The still comes first. Once the page has loaded, the clip on screen is
 * downloaded, and the next one when it is nearly due. A changing `clip` cuts to that one.
 */
export function Backdrop({ paused = false, clip }: { paused?: boolean; clip?: number }) {
  const idle = useIdle()
  const allowed = useAllowed() && idle
  const [active, setActive] = useState(0)
  // The clip after this one is due soon.
  const [due, setDue] = useState<number | null>(null)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  useEffect(() => {
    if (clip !== undefined) setActive(clip % CLIPS.length)
  }, [clip])
  const next = (active + 1) % CLIPS.length

  useEffect(() => {
    const video = videos.current[active]
    if (!video || !allowed) return
    const sync = () => {
      if (paused || document.hidden) video.pause()
      else void video.play().catch(() => {})
    }
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [active, allowed, paused])

  // The clip that just left plays on under the fade, then goes back to its first frame.
  useEffect(() => {
    const left = videos.current[active]
    return () => {
      setTimeout(() => {
        if (!left || getComputedStyle(left).opacity === "1") return
        left.pause()
        left.currentTime = 0
      }, FADE * 1000)
    }
  }, [active])

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-black">
      <picture>
        {POSTERS.map((p) => (
          <source key={p.src} srcSet={p.src} type={p.type} media={p.media} />
        ))}
        <img
          src={POSTERS[POSTERS.length - 1].src}
          alt=""
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      </picture>
      {allowed &&
        CLIPS.map((clip, i) => (
          <video
            key={clip}
            ref={(el) => {
              videos.current[i] = el
            }}
            muted
            playsInline
            preload={i === active || (i === next && due === active) ? "auto" : "none"}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-1000",
              i === active ? "opacity-100" : "opacity-0"
            )}
            onTimeUpdate={(e) => {
              const { currentTime, duration } = e.currentTarget
              if (i !== active) return
              if (duration - currentTime < FADE) setActive(next)
              else if (duration - currentTime < FADE + AHEAD) setDue(active)
            }}
          >
            <source src={`/video/${clip}-1080.mp4`} type="video/mp4" media="(min-width: 48rem)" />
            <source src={`/video/${clip}-720.mp4`} type="video/mp4" />
          </video>
        ))}
    </div>
  )
}
