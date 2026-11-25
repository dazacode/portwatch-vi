import Link from "next/link"
import { NavLink } from "@/components/nav-link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/wordmark"
import { SITE } from "@/lib/site"

const NAV = [
  { href: "/", label: "Live" },
  { href: "/standings", label: "Standings" },
  { href: "/news", label: "News" },
  { href: "/method", label: "Method" },
]

export function SiteHeader() {
  return (
    <header>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-1 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={SITE.name}>
          <Wordmark />
        </Link>
        <nav
          aria-label="Main"
          className="order-3 flex w-full gap-5 text-sm sm:order-none sm:w-auto"
        >
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
      <div aria-hidden="true" className="grid gap-0.5">
        <div className="h-0.5 bg-stripe-1" />
        <div className="h-0.5 bg-stripe-2" />
        <div className="h-0.5 bg-stripe-3" />
      </div>
    </header>
  )
}
