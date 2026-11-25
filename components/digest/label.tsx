import { utcDay, utcTime } from "@/lib/format"

/** Says who wrote the text above it. Every place that shows the digest shows this. */
export function DigestLabel({ by, at }: { by: string | null; at: string }) {
  const when = `${utcDay(at)}, ${utcTime(at)}`
  return (
    <p className="text-xs text-muted-foreground">
      {by
        ? `Written by an AI model (${by}) from the linked sources on ${when}. It can be wrong.`
        : `Picked by rules from the linked sources on ${when}. No AI model answered.`}
    </p>
  )
}
