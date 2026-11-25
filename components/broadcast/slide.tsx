"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { SplitText } from "gsap/SplitText"
import { useRef } from "react"
import { Roll } from "@/components/broadcast/roll"
import { Stars } from "@/components/broadcast/stars"
import type { Slide } from "@/lib/broadcast"
import { ago, utcDay } from "@/lib/format"

gsap.registerPlugin(useGSAP, SplitText)

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <p data-plate className="w-fit bg-stripe-1 px-3 py-1 text-base font-bold text-black sm:text-lg">
      {children}
    </p>
  )
}

const titleClass =
  "max-w-5xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl xl:text-8xl"
const longTitleClass =
  "line-clamp-6 max-w-4xl text-2xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl"

function Body({ slide, at }: { slide: Slide; at: string }) {
  switch (slide.kind) {
    case "milestone":
      return (
        <>
          <Plate>{slide.debut ? "New on the board" : "Milestone"}</Plate>
          <h2 data-title className={titleClass}>
            {slide.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Stars count={slide.stars} label={slide.size} />
            <span data-rise className="text-2xl font-bold sm:text-3xl">
              {slide.size}
            </span>
          </div>
          <p data-rise className="max-w-3xl text-base text-white/90 sm:text-xl">
            <span className="mr-1 text-3xl font-extrabold text-stripe-3 sm:text-5xl">
              {slide.debut ? (
                <Roll from={0} to={slide.to} suffix="%" />
              ) : (
                <Roll from={0} to={slide.points} prefix="+" />
              )}
            </span>{" "}
            {slide.debut ? "on arrival. " : `points, from ${slide.from}% to ${slide.to}%. `}
            {!slide.debut && `${slide.compare}. `}
            {slide.notes.map((n) => `${n}. `)}
            <span className="text-white/75">{ago(slide.at, at)}</span>
          </p>
        </>
      )
    case "race":
      return (
        <>
          <Plate>The race: verified, then claimed</Plate>
          <ol className="w-full max-w-3xl space-y-3">
            {slide.rows.map((r, i) => (
              <li key={r.id} data-rise>
                <div className="flex justify-between gap-4 text-lg font-bold sm:text-2xl">
                  <span className="truncate">
                    {i + 1}. {r.name}
                  </span>
                  <span>
                    <Roll from={0} to={r.verified} suffix="%" />
                    <span className="ml-2 text-base font-medium text-white/75 sm:text-lg">
                      {r.next ? `${r.next}, ` : ""}
                      {r.score}% claimed
                    </span>
                  </span>
                </div>
                <div
                  className="relative h-3 bg-white/15 sm:h-4"
                  style={{ color: `var(--stripe-${(i % 3) + 1})` }}
                >
                  <div
                    data-bar
                    className="absolute inset-y-0 left-0 origin-left bg-current opacity-35"
                    style={{ width: `${r.score}%` }}
                  />
                  <div
                    data-bar
                    className="absolute inset-y-0 left-0 origin-left bg-current"
                    style={{ width: `${r.verified}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      )
    case "commit":
      return (
        <>
          <Plate>Just pushed</Plate>
          <h2 data-title className={titleClass}>
            {slide.commit.name}
          </h2>
          <p data-rise className="line-clamp-3 max-w-4xl text-xl text-white/90 sm:text-3xl">
            {slide.commit.message}
          </p>
          <p data-rise className="text-white/75 sm:text-lg">
            {ago(slide.commit.at, at)}, commit {slide.commit.sha}
          </p>
        </>
      )
    case "update":
      return (
        <>
          <Plate>Update</Plate>
          <h2 data-title className={longTitleClass}>
            {slide.text}
          </h2>
          <p data-rise className="text-white/75 sm:text-lg">
            {utcDay(slide.date)}
          </p>
        </>
      )
    case "wire":
      return (
        <>
          <Plate>Breaking</Plate>
          <h2 data-title className={titleClass}>
            {slide.item.title}
          </h2>
          <p data-rise className="line-clamp-3 max-w-4xl text-xl text-white/90 sm:text-3xl">
            {slide.item.detail}
          </p>
          <p data-rise className="text-white/75 sm:text-lg">
            {ago(slide.item.at, at)}, from the public commit feed
          </p>
        </>
      )
    case "trailer":
      return (
        <>
          <Plate>From Rockstar Games</Plate>
          <h2 data-title className={longTitleClass}>
            {slide.stream.title}
          </h2>
          <p data-rise className="text-white/85 sm:text-lg">
            The official trailer, on YouTube. The console version, not a PC build.
          </p>
        </>
      )
  }
}

/** One slide and its entrance. Mounted fresh for each slide. */
export function SlideBody({ slide, at }: { slide: Slide; at: string }) {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
        tl.from("[data-plate]", { xPercent: -120, autoAlpha: 0, duration: 0.45 })
        const title = root.current?.querySelector("[data-title]")
        if (title) {
          const split = SplitText.create(title, { type: "words,chars" })
          tl.from(
            split.chars,
            {
              yPercent: 90,
              rotation: "random(-25, 25)",
              autoAlpha: 0,
              ease: "back.out(1.8)",
              duration: 0.55,
              stagger: { amount: Math.min(0.7, split.chars.length * 0.03) },
            },
            0.12
          )
        }
        tl.from(
          "[data-star-rating]",
          { scale: 0, rotation: -200, ease: "elastic.out(1, 0.5)", duration: 1, stagger: 0.14 },
          0.45
        )
          .from("[data-rise]", { y: 28, autoAlpha: 0, duration: 0.5, stagger: 0.09 }, 0.4)
          .from("[data-bar]", { scaleX: 0, ease: "expo.out", duration: 1.3, stagger: 0.1 }, 0.5)
      })
    },
    { scope: root }
  )
  return (
    <div ref={root} className="flex flex-col gap-3 sm:gap-5">
      <Body slide={slide} at={at} />
    </div>
  )
}
