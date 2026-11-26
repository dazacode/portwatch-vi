import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** The question everyone comes with, answered by a sign that writes itself and catches. */
export function Answer({
  done,
  unofficial,
  compact,
  still,
}: {
  done: boolean
  /** A fan build is Playable, so the answer is yes, but not from Rockstar. */
  unofficial: boolean
  /** Beside an open panel. */
  compact: boolean
  still: boolean
}) {
  const text = done || unofficial ? "Yes" : "Not yet"
  return (
    <div
      className={cn(
        "short:flex short:items-center short:justify-center short:gap-5",
        // Above a panel there is little height, beside one there is.
        compact && "max-lg:flex max-lg:items-center max-lg:justify-center max-lg:gap-3"
      )}
    >
      <h2
        className={cn(
          "leading-tight font-extrabold tracking-tight text-balance",
          compact
            ? "text-[clamp(1.1rem,min(5vw,4svh),2.25rem)] short:text-base"
            : "text-[clamp(1.35rem,min(6.2vw,6.5svh),3.75rem)]"
        )}
      >
        Is GTA 6 on PC?
      </h2>
      <p
        data-still={still || undefined}
        className={cn(
          "sign font-script",
          compact
            ? "text-[clamp(2.75rem,min(13vw,11svh),6rem)] short:text-5xl"
            : "text-[clamp(4rem,min(25vw,27svh),14rem)] short:text-[4.5rem]"
        )}
      >
        <span className="sign-tube">{text}</span>
        <span aria-hidden="true" className="sign-light">
          {text}
        </span>
      </p>
      {unofficial && !done && (
        <div
          className={cn(
            "flex flex-col items-center gap-3",
            // Clear of the tail of the Y, which hangs below the sign.
            compact
              ? "mt-[clamp(0.25rem,3svh,1.5rem)] gap-2 max-lg:mt-0"
              : "mt-[clamp(0.5rem,6svh,3.5rem)] short:mt-0"
          )}
        >
          <p
            className={cn(
              "font-semibold tracking-[0.2em] text-white/85 uppercase",
              compact ? "text-xs" : "text-sm sm:text-base"
            )}
          >
            Unofficially
          </p>
          <Link
            href="/standings"
            className={cn(
              buttonVariants({ size: compact ? "sm" : "lg" }),
              "bg-white text-black hover:bg-white/85"
            )}
          >
            See the standings
          </Link>
        </div>
      )}
    </div>
  )
}
