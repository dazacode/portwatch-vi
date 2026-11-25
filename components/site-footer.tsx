import { SITE } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t text-sm text-muted-foreground">
      <div className="mx-auto grid max-w-7xl gap-2 px-4 py-6 sm:px-6">
        <p>
          Nothing here hosts or links to game files, keys or executables. Anything offering a GTA VI
          PC download is a scam.
        </p>
        <p>
          Unofficial, and not affiliated with Rockstar Games, Take-Two or Microsoft. A fork of{" "}
          <a className="underline underline-offset-4 hover:text-foreground" href={SITE.upstream}>
            PortWatch VI by 4lwayz
          </a>
          , whose research and scores it started from.
        </p>
      </div>
    </footer>
  )
}
