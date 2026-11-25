/** Real Miami, for the backdrop. Cut from one film; the credit is in the footer. */
export const CLIPS = ["sunset", "wheel", "marina", "beach", "boats"] as const

// The first frame of the first clip. Tall screens only show its middle, so they get only that.
const TALL = "(max-aspect-ratio: 3/5)"
export const POSTERS = [
  { src: "/video/poster-tall.avif", type: "image/avif", media: TALL },
  { src: "/video/poster-tall.webp", type: "image/webp", media: TALL },
  { src: "/video/poster.avif", type: "image/avif" },
  { src: "/video/poster.webp", type: "image/webp" },
]

export const FOOTAGE = {
  author: "The Nomad With The Drone",
  source: "https://commons.wikimedia.org/wiki/File:Miami_DJI_Mini_4_Pro_Cinematic_4K_(60FPS).webm",
  license: "CC BY 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
}
