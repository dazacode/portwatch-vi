/**
 * The strip above the header. Change `id` when the message changes, so visitors who closed the
 * last one see the new one. Set `on` to false to take it down.
 */
export const PROMO = {
  id: "vilauncher-1",
  on: true,
  name: "VILauncher",
  pitch: "install, update and play community projects from one Windows app.",
  short: "now on GitHub.",
  cta: "Get it on GitHub",
  href: "https://github.com/dazacode/vilauncher",
} as const

/** Where a visitor's choice is kept: the id of the strip they closed. */
export const PROMO_KEY = "promo-closed"

/** Hides a strip the visitor has closed before the first paint, so it doesn't flash. */
export const promoScript = () =>
  `try{if(localStorage.getItem("${PROMO_KEY}")===${JSON.stringify(PROMO.id)})document.documentElement.dataset.promo="closed"}catch(e){}`
