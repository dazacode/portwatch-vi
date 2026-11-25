import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Breadcrumb } from "@/components/breadcrumb"
import { Container } from "@/components/container"
import { JsonLd } from "@/components/json-ld"
import { utcDay, utcTime } from "@/lib/format"
import { articleLd, articleMeta, PAGES, pageMeta } from "@/lib/seo"
import { getTracker } from "@/lib/tracker"

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

const find = async (id: string) => (await getTracker()).news.find((n) => n.id === id)

export async function generateStaticParams() {
  return (await getTracker()).news.map(({ id }) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await find((await params).id)
  return article ? pageMeta(articleMeta(article)) : notFound()
}

export default async function Page({ params }: Props) {
  const article = await find((await params).id)
  if (!article) notFound()
  return (
    <Container className="max-w-2xl pt-8 wrap-anywhere">
      <JsonLd data={articleLd(article)} />
      <Breadcrumb
        parent={{ name: "News", path: PAGES.news.path }}
        page={{ name: article.title, path: `/news/${article.id}` }}
      />
      <h1 className="mt-2 text-3xl font-bold">{article.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{article.dek}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {article.category},{" "}
        <time dateTime={article.publishedAt ?? article.date}>
          {utcDay(article.publishedAt ?? article.date)}
          {article.publishedAt && `, ${utcTime(article.publishedAt)}`}
        </time>
      </p>
      <div className="pane mt-6 space-y-4 p-5 sm:p-7">
        {article.body.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      {article.sources.length > 0 && (
        <div className="mt-8 text-sm">
          <h2 className="font-medium">Sources</h2>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {article.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {s.outlet}: {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  )
}
