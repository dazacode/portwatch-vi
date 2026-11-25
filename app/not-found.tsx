import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/container"

export const metadata: Metadata = {
  title: "Page not found",
  description: "There is no page at this address.",
}

const link = "underline underline-offset-4 hover:text-foreground"

export default function NotFound() {
  return (
    <Container className="pt-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        There is no page at this address. A project or an article may have been removed.
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <Link href="/" className={link}>
            Live and countdown
          </Link>
        </li>
        <li>
          <Link href="/standings" className={link}>
            All standings
          </Link>
        </li>
        <li>
          <Link href="/news" className={link}>
            All news
          </Link>
        </li>
      </ul>
    </Container>
  )
}
