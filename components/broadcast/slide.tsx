import { Stars } from "@/components/broadcast/stars"
import type { Slide } from "@/lib/broadcast"
import { ago, utcDay } from "@/lib/format"

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <p className="w-fit bg-stripe-1 px-2 py-0.5 text-sm font-semibold text-black">{children}</p>
  )
}

const titleClass = "max-w-3xl text-2xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl"

export function SlideBody({ slide, at }: { slide: Slide; at: string }) {
  switch (slide.kind) {
    case "milestone":
      return (
        <>
          <Plate>{slide.debut ? "New on the board" : "Milestone"}</Plate>
          <h2 className={titleClass}>{slide.title}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Stars count={slide.stars} label={slide.size} />
            <span className="text-lg font-semibold">{slide.size}</span>
          </div>
          <p className="text-white/90">
            <span className="text-2xl font-bold text-stripe-3">
              {slide.debut ? `${slide.to}%` : `+${slide.points}`}
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
          <Plate>The race right now</Plate>
          <ol className="w-full max-w-xl space-y-2">
            {slide.rows.map((r, i) => (
              <li key={r.id}>
                <div className="flex justify-between gap-4 text-sm font-semibold sm:text-base">
                  <span className="truncate">
                    {i + 1}. {r.name}
                  </span>
                  <span>{r.score}%</span>
                </div>
                <div className="h-2.5 bg-white/15">
                  <div
                    className="h-full origin-left motion-safe:animate-[grow_900ms_ease-out_both]"
                    style={{
                      width: `${r.score}%`,
                      backgroundColor: `var(--stripe-${(i % 3) + 1})`,
                      animationDelay: `${i * 120}ms`,
                    }}
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
          <h2 className={titleClass}>{slide.commit.name}</h2>
          <p className="line-clamp-3 max-w-2xl text-lg text-white/90 sm:text-xl">
            {slide.commit.message}
          </p>
          <p className="text-white/75">
            {ago(slide.commit.at, at)}, commit {slide.commit.sha}
          </p>
        </>
      )
    case "update":
      return (
        <>
          <Plate>Update</Plate>
          <h2 className="line-clamp-5 max-w-3xl text-xl leading-snug font-semibold text-balance sm:text-3xl">
            {slide.text}
          </h2>
          <p className="text-white/75">{utcDay(slide.date)}</p>
        </>
      )
  }
}
