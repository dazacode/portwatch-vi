/** Any part of the page can open the share sheet: the header button, the first-visit toast. */
export const OPEN_SHARE = "viportlive:share"

export const openShare = () => window.dispatchEvent(new Event(OPEN_SHARE))

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

/** GA4's own share event, so we can see which way people share. Only production loads the tag. */
export function trackShare(method: string) {
  window.dataLayer?.push({ event: "share", method, content_type: "website" })
}
