import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Container } from "@/components/container"
import { utcDay } from "@/lib/format"
import { getTracker } from "@/lib/tracker"

export const revalidate = 300

type Props = { params: Promise<{ id: string }> }

const find = async (id: string) => (await getTracker()).news.find((n) => n.id === id)

export async function generateStaticParams() {
  return (await getTracker()).news.map(({ id }) => ({ id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await find((await params).id)
  return { title: article?.title ?? "Article", description: article?.dek }
}

export default async function Page({ params }: Props) {
  const article = await find((await params).id)
  if (!article) notFound()
  return (
    <Container className="max-w-2xl pt-8">
      <Link
        href="/news"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        News
      </Link>
      <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
        {article.category} · {utcDay(article.date)}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{article.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{article.dek}</p>
      <div className="mt-6 space-y-4">
        {article.body.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      {article.sources.length > 0 && (
        <div className="mt-8 border-t pt-4 text-sm">
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
