"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { SplitText } from "gsap/SplitText"
import { useRef } from "react"
import { Roll } from "@/components/broadcast/roll"
import { Stars } from "@/components/broadcast/stars"
import type { Slide } from "@/lib/broadcast"
import { ago, utcDay, utcTime } from "@/lib/format"

gsap.registerPlugin(useGSAP, SplitText)

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-plate
      className="w-fit rounded-full bg-stripe-1 px-4 py-1 text-base font-bold text-black sm:text-lg"
    >
      {children}
    </p>
  )
}

const titleClass =
  "max-w-5xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl xl:text-8xl short:text-4xl"
const longTitleClass =
  "line-clamp-6 max-w-4xl text-2xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl short:text-2xl"

type Hold = (held: boolean) => void

function Body({ slide, at, onHold }: { slide: Slide; at: string; onHold?: Hold }) {
  switch (slide.kind) {
    case "breakdown": {
      const { headline, sentences, by, at: written } = slide.breakdown
      return (
        <>
          <Plate>Breakdown</Plate>
          <h2
            data-title
            className="max-w-4xl text-xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl short:text-xl"
          >
            {headline}
          </h2>
          <ul className="max-w-3xl space-y-2 text-sm leading-snug text-white/95 sm:space-y-3 sm:text-xl short:max-w-none short:space-y-1 short:text-sm">
            {sentences.map((s) => (
              <li key={s.text} data-rise className="max-[359px]:nth-3:hidden">
                <span className="max-sm:line-clamp-5">{s.text}</span>{" "}
                {s.sources.map((source) => (
                  <a
                    key={source.ref}
                    href={source.href}
                    {...(source.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="mr-2 text-white/75 underline underline-offset-4 hover:text-white sm:text-base short:text-xs"
                    onFocus={(e) => onHold?.(e.target.matches(":focus-visible"))}
                    onBlur={() => onHold?.(false)}
                    onMouseEnter={() => onHold?.(true)}
                    onMouseLeave={() => onHold?.(false)}
                  >
                    {source.label}
                  </a>
                ))}
              </li>
            ))}
          </ul>
          <p data-rise className="max-w-3xl text-xs text-white/75 sm:text-sm short:text-xs">
            Written by an AI model<span className="max-sm:hidden"> ({by})</span> from the linked
            sources on {utcDay(written)}, {utcTime(written)}. It can be wrong.
          </p>
        </>
      )
    }
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
    case "board":
      return (
        <>
          <Plate>{slide.event.kind === "joined" ? "New on the board" : "Moved to dead"}</Plate>
          <h2 data-title className={titleClass}>
            {slide.event.title}
          </h2>
          <p
            data-rise
            className="line-clamp-5 max-w-4xl text-lg text-white/90 sm:text-2xl short:line-clamp-2 short:text-lg"
          >
            {slide.event.detail}
          </p>
          <p data-rise className="text-white/75 sm:text-lg">
            {utcDay(slide.event.at)}
          </p>
        </>
      )
    case "race":
      return (
        <>
          <Plate>The race: score, then claim</Plate>
          <ol className="w-full max-w-3xl space-y-3">
            {slide.rows.map((r, i) => (
              <li key={r.id} data-rise>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-lg font-bold sm:text-2xl">
                  <span className="min-w-0 flex-1 truncate">
                    {i + 1}. <span translate="no">{r.name}</span>
                  </span>
                  <Roll from={0} to={r.rating} suffix="%" />
                  <span className="text-sm font-medium text-white/85 max-sm:basis-full sm:text-lg">
                    {r.next ? `${r.next}, ` : ""}
                    {r.score}% claimed
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
                    style={{ width: `${r.rating}%` }}
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
          <p
            data-rise
            className="line-clamp-3 max-w-4xl text-xl text-white/90 sm:text-3xl short:line-clamp-2 short:text-lg"
          >
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
          <p
            data-rise
            className="line-clamp-3 max-w-4xl text-xl text-white/90 sm:text-3xl short:line-clamp-2 short:text-lg"
          >
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
export function SlideBody({ slide, at, onHold }: { slide: Slide; at: string; onHold?: Hold }) {
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
    <div ref={root} className="flex flex-col gap-3 wrap-anywhere sm:gap-5 short:gap-2">
      <Body slide={slide} at={at} onHold={onHold} />
      {slide.note && (
        <p data-rise className="max-w-3xl text-sm text-white/90 sm:text-lg short:text-sm">
          {slide.note}{" "}
          <span className="text-white/75">Written by an AI model. It can be wrong.</span>
        </p>
      )}
    </div>
  )
}
