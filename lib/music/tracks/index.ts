import type { TrackId } from "@/lib/music/playlist"
import type { Track } from "@/lib/music/track"
import { calleOchoHeat } from "@/lib/music/tracks/calle-ocho-heat"
import { gladesAtDawn } from "@/lib/music/tracks/glades-at-dawn"
import { midnightPursuit } from "@/lib/music/tracks/midnight-pursuit"
import { neonCauseway } from "@/lib/music/tracks/neon-causeway"
import { newsroomTide } from "@/lib/music/tracks/newsroom-tide"
import { palmKeys } from "@/lib/music/tracks/palm-keys"

export const TRACKS: Record<TrackId, Track> = {
  "newsroom-tide": newsroomTide,
  "neon-causeway": neonCauseway,
  "palm-keys": palmKeys,
  "calle-ocho-heat": calleOchoHeat,
  "glades-at-dawn": gladesAtDawn,
  "midnight-pursuit": midnightPursuit,
}
