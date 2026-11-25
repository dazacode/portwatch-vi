import type { Metadata, Viewport } from "next"
import { Schibsted_Grotesk, Yellowtail } from "next/font/google"
import { BoardNotice } from "@/components/board/notice"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"
import "./globals.css"

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans" })
const script = Yellowtail({ subsets: ["latin"], weight: "400", variable: "--font-script" })

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fef8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#120c21" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans antialiased", sans.variable, script.variable)}
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <BoardNotice />
        </ThemeProvider>
      </body>
    </html>
  )
}
