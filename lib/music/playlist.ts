// The built-in soundtrack: original pieces written as code and played by synthesizers in the
// browser, so there are no audio files to download or license. Every piece picks fresh chords,
// rhythms and melodies each time it starts. Names only here, so the controls can show them
// without loading the music.

export const PLAYLIST = [
  { id: "newsroom-tide", title: "Newsroom Tide", mood: "Miami synths, congas and steel drum" },
  { id: "neon-causeway", title: "Neon Causeway", mood: "Night-drive synthwave" },
  { id: "palm-keys", title: "Palm Keys", mood: "Lo-fi electric piano" },
  { id: "calle-ocho-heat", title: "Calle Ocho Heat", mood: "Dembow, montuno and horns" },
  { id: "glades-at-dawn", title: "Glades at Dawn", mood: "Ambient bells over the swamp" },
  { id: "midnight-pursuit", title: "Midnight Pursuit", mood: "A chase at 124 BPM" },
] as const

export type TrackId = (typeof PLAYLIST)[number]["id"]
