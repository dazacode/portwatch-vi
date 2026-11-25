import { cn } from "@/lib/utils"

/** The question everyone comes with, answered by a sign that writes itself and catches. */
export function Answer({
  done,
  compact,
  still,
}: {
  done: boolean
  /** Beside an open panel. */
  compact: boolean
  still: boolean
}) {
  const text = done ? "Yes" : "Not yet"
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
    </div>
  )
}
