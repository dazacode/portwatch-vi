import { utcDay } from "@/lib/format"
import { ORIGIN_LABEL, type Project } from "@/lib/standings"

const Day = ({ at }: { at: string }) => (
  <time dateTime={at} className="whitespace-nowrap text-foreground">
    {utcDay(at)}
  </time>
)

export function ProjectDates({ project: { origin, lastCode } }: { project: Project }) {
  return (
    <>
      <span className="block">
        {origin ? (
          <>
            {ORIGIN_LABEL[origin.kind]} <Day at={origin.at} />
          </>
        ) : (
          "First date unknown"
        )}
      </span>
      {lastCode && (
        <span className="block">
          {lastCode.kind === "push" ? "Last push" : "Last commit"} <Day at={lastCode.at} />
        </span>
      )}
    </>
  )
}
