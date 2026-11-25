import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Ranks } from "@/lib/standings"
import { cn } from "@/lib/utils"

const TABS: { key: Ranks; label: string; note: string }[] = [
  {
    key: "public",
    label: "Official",
    note: "Public code. Claims others have tested count for more.",
  },
  { key: "everyone", label: "With private", note: "Everyone, scored by the same rules." },
]

/** The one choice there is, in the leaders panel and on the standings page. */
export function RanksTabs({
  ranks,
  onChange,
  className,
}: {
  ranks: Ranks
  onChange: (ranks: Ranks) => void
  className?: string
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <ToggleGroup
        aria-label="Ranking"
        variant="outline"
        spacing={0}
        value={[ranks]}
        onValueChange={([next]) => next && onChange(next as Ranks)}
      >
        {TABS.map((t) => (
          <ToggleGroupItem key={t.key} value={t.key} className="px-4!">
            {t.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-sm text-muted-foreground in-[#opening-panel]:text-white/85">
        {TABS.find((t) => t.key === ranks)?.note}
      </p>
    </div>
  )
}
