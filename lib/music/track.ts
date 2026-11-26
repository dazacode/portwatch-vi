import type * as Tone from "tone"

/** One bar of a track: when it starts, which bar it is, and where its sixteenths fall. */
export type Beat = {
  time: number
  /** Counts from 0 at the start of the track. */
  n: number
  /** One sixteenth, in seconds. */
  step: number
  /** The time of a sixteenth in this bar, swung if the track swings. */
  at: (step: number) => number
}

/** What a track is given to build its band. Everything it keeps is disposed when it ends. */
export type Rig = {
  keep: <T extends Tone.ToneAudioNode>(node: T) => T
  /** A fader into the track's output, with sends to the shared room and echo. */
  channel: (db: number, sends?: ("room" | "echo")[]) => Tone.Volume
}

export type Track = {
  bpm: number
  /** How long it plays before the next track starts. */
  bars: number
  /** 0 to 1: how late the off-beat sixteenths land. */
  swing?: number
  build: (rig: Rig) => (beat: Beat) => void
}
