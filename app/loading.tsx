import { NeonMark } from "@/components/neon-mark"

export default function Loading() {
  return (
    <div role="status" className="neon-wait grid min-h-[70svh] place-items-center">
      <NeonMark className="w-40" />
      <span className="sr-only">Loading</span>
    </div>
  )
}
