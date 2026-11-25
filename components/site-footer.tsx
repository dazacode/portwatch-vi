import { FOOTAGE } from "@/lib/footage"
import { FEED } from "@/lib/seo"
import { ANSWER } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="mt-16 text-sm text-muted-foreground">
      <div aria-hidden="true" className="grid gap-0.5">
        <div className="h-0.5 bg-stripe-1" />
        <div className="h-0.5 bg-stripe-2" />
        <div className="h-0.5 bg-stripe-3" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-2 px-4 py-6 sm:px-6">
        <p>
          Nothing here hosts or links to game files, keys or executables. Anything offering a GTA VI
          PC download is a scam.
        </p>
        <p>
          Unofficial, and not affiliated with Rockstar Games, Take-Two or Microsoft.{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href={FEED}>
            RSS feed
          </a>
          {" · "}
          <a className="underline underline-offset-4 hover:text-foreground" href={ANSWER.url}>
            {ANSWER.name}
          </a>
        </p>
        <p>
          Visits are counted with Google Analytics, with cookies except in the EEA, the UK and
          Switzerland.
        </p>
        <p>
          Miami footage by{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href={FOOTAGE.source}>
            {FOOTAGE.author}
          </a>
          ,{" "}
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href={FOOTAGE.licenseUrl}
          >
            {FOOTAGE.license}
          </a>
          , cut into short clips and compressed. The music is original and played by the browser.
        </p>
      </div>
    </footer>
  )
}
