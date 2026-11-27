import Link from "next/link"
import { HeaderShell } from "@/components/header-shell"
import { HolidayToggle } from "@/components/holiday/toggle"
import { LanguagePicker } from "@/components/language-picker"
import { NavLink } from "@/components/nav-link"
import { ShareButton } from "@/components/share/share-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/wordmark"
import { SITE } from "@/lib/site"

const NAV = [
  { href: "/", label: "Live" },
  { href: "/standings", label: "Standings" },
  { href: "/news", label: "News" },
  { href: "/can-i-run-it", label: "Can I run it" },
  { href: "/verify", label: "Verify" },
  { href: "/method", label: "Method" },
]

export function SiteHeader() {
  return (
    <HeaderShell>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 md:pr-2 md:pl-6">
        <Link href="/" aria-label={SITE.name} className="flex min-h-10 items-center">
          <Wordmark />
        </Link>
        <nav
          aria-label="Main"
          className="relative order-3 -mx-2 flex w-[calc(100%+1rem)] overflow-x-auto overscroll-x-contain text-sm [scrollbar-width:none] max-md:justify-between md:order-none md:mx-0 md:w-auto md:gap-1 [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="ml-auto flex items-center">
          <LanguagePicker />
          <ShareButton />
          <HolidayToggle />
          <ThemeToggle />
        </div>
      </div>
    </HeaderShell>
  )
}
