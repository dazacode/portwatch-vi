import { toJsonLd } from "@/lib/seo"

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: toJsonLd escapes what could end the script
      dangerouslySetInnerHTML={{ __html: toJsonLd(data) }}
    />
  )
}
