import Link from "next/link"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo"

/** The way back, and the same trail for search engines. */
export function Breadcrumb({
  parent,
  page,
}: {
  parent: { name: string; path: string }
  page: { name: string; path: string }
}) {
  return (
    <nav aria-label="Breadcrumb">
      <JsonLd data={breadcrumbLd([parent, page])} />
      <Link
        href={parent.path}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {parent.name}
      </Link>
    </nav>
  )
}
