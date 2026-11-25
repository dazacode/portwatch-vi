"use client"

import { useEffect, useRef } from "react"

// Drawn in a box 100 wide, around its middle.
const SHAPES = [
  // Maple
  "M0-50L8-32L19-38L16-14L30-26L34-17L48-19L42-6L50 0L24 16L27 26L3 22L2 50L-2 50L-3 22L-27 26L-24 16L-50 0L-42-6L-48-19L-34-17L-30-26L-16-14L-19-38L-8-32Z",
  // Oak
  "M0-50C10-50 14-40 10-34C22-36 26-24 16-18C28-18 30-4 18 0C28 2 26 16 14 16C18 24 10 32 3 30L2 50L-2 50L-3 30C-10 32-18 24-14 16C-26 16-28 2-18 0C-30-4-28-18-16-18C-26-24-22-36-10-34C-14-40-10-50 0-50Z",
  // Beech
  "M0-50C24-28 27 6 2 32L1 50L-1 50L-2 32C-27 6-24-28 0-50Z",
]
const VEINS = [
  "M0 40L0-36M0 8L32-8M0 8L-32-8M0-8L12-26M0-8L-12-26",
  "M0 42L0-40M0 14L12 8M0 14L-12 8M0-4L14-10M0-4L-14-10M0-20L8-27M0-20L-8-27",
  "M0 44L0-42M0 16L15 4M0 16L-15 4M0-2L16-14M0-2L-16-14M0-18L11-28M0-18L-11-28",
]
const COLORS = ["#d9622b", "#e8a13a", "#b23a2e", "#8f2f3f", "#c98a2b", "#a65a24"]
const MAX_WIND = 260

type Leaf = {
  x: number
  y: number
  fall: number
  size: number
  angle: number
  spin: number
  /** Tumbling, as if it turned in the air. */
  turn: number
  turnSpeed: number
  sway: number
  shape: number
  color: string
  /** 0 is far away, 1 is close. */
  depth: number
}

const between = (a: number, b: number) => a + Math.random() * (b - a)

function make(width: number, height: number, anywhere: boolean): Leaf {
  const depth = Math.random()
  return {
    x: between(-0.15, 1.05) * width,
    y: anywhere ? between(-0.1, 1) * height : between(-90, -30),
    fall: 22 + depth * 46,
    size: 12 + depth * depth * 34,
    angle: between(0, Math.PI * 2),
    spin: between(-0.7, 0.7),
    turn: between(0, Math.PI * 2),
    turnSpeed: between(0.6, 1.8),
    sway: between(0, Math.PI * 2),
    shape: Math.floor(Math.random() * SHAPES.length),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    depth,
  }
}

/**
 * Autumn leaves over the opening. A gust brings them in, the pointer stirs them. They hold still with
 * reduced motion or a paused background, and stop out of view or in a hidden tab.
 */
export function Leaves({ still }: { still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(still)
  const wake = useRef<() => void>(() => {})

  useEffect(() => {
    pausedRef.current = still
    wake.current()
  }, [still])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const shapes = SHAPES.map((d) => new Path2D(d))
    const veins = VEINS.map((d) => new Path2D(d))
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)")
    let width = 0
    let height = 0
    let leaves: Leaf[] = []
    let frame = 0
    let last = 0
    let time = 0
    let wind = 0
    let seen = true
    let pointer: { x: number; at: number } | null = null
    let nextGust = 0

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      for (const l of leaves) {
        const scale = l.size / 100
        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.angle)
        ctx.scale(scale * (0.25 + 0.75 * Math.abs(Math.cos(l.turn))), scale)
        ctx.globalAlpha = 0.5 + l.depth * 0.45
        ctx.fillStyle = l.color
        ctx.fill(shapes[l.shape])
        ctx.globalAlpha *= 0.4
        ctx.strokeStyle = "#3a1408"
        ctx.lineWidth = 3
        ctx.stroke(veins[l.shape])
        ctx.restore()
      }
    }

    const size = () => {
      const box = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const [oldWidth, oldHeight] = [width, height]
      width = box.width
      height = box.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      const count = Math.round(Math.min(34, Math.max(14, (width * height) / 42_000)))
      if (leaves.length === 0)
        leaves = Array.from({ length: count }, () => make(width, height, true))
      else {
        for (const l of leaves) {
          l.x *= width / (oldWidth || width)
          l.y *= height / (oldHeight || height)
        }
        while (leaves.length < count) leaves.push(make(width, height, true))
        leaves.length = count
      }
      leaves.sort((a, b) => a.depth - b.depth)
      draw()
    }

    const step = (now: number) => {
      // A tab that was away doesn't make up for it all at once.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      if (time > nextGust) {
        wind += between(90, 190)
        nextGust = time + between(7, 12)
      }
      wind *= 0.985 ** (dt * 60)
      for (const l of leaves) {
        const near = 0.45 + l.depth * 0.75
        const push = wind * near
        l.x += (14 * near + push + Math.sin(time * 1.1 + l.sway) * 22) * dt
        l.y += (l.fall - Math.min(l.fall * 0.5, Math.abs(push) * 0.12)) * dt
        l.angle += (l.spin + push * 0.006) * dt
        l.turn += l.turnSpeed * (1 + Math.abs(push) * 0.006) * dt
        if (l.y > height + 40)
          Object.assign(l, make(width, height, false), {
            depth: l.depth,
            size: l.size,
            fall: l.fall,
          })
        if (l.x > width + 60) l.x = -50
        else if (l.x < -60) l.x = width + 50
      }
      draw()
      frame = requestAnimationFrame(step)
    }

    const sync = () => {
      const run = seen && !document.hidden && !calm.matches && !pausedRef.current
      if (run && frame === 0) {
        last = performance.now()
        frame = requestAnimationFrame(step)
      } else if (!run && frame !== 0) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
    wake.current = sync

    const onMove = (e: PointerEvent) => {
      if (pointer && e.timeStamp > pointer.at) {
        const speed = (e.clientX - pointer.x) / (e.timeStamp - pointer.at)
        wind = Math.max(-MAX_WIND, Math.min(MAX_WIND, wind + speed * 9))
      }
      pointer = { x: e.clientX, at: e.timeStamp }
    }

    const resize = new ResizeObserver(size)
    const view = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting
      sync()
    })
    resize.observe(canvas)
    view.observe(canvas)
    window.addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("visibilitychange", sync)
    calm.addEventListener("change", sync)
    sync()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      view.disconnect()
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("visibilitychange", sync)
      calm.removeEventListener("change", sync)
      wake.current = () => {}
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in"
    >
      <canvas ref={ref} className="size-full" />
    </div>
  )
}
