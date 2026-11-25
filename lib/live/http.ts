import type { z } from "zod"

const UA = "viportlive/0.1"

type Options = {
  revalidate: number
  headers?: Record<string, string>
}

async function get(url: string, { revalidate, headers }: Options) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res
}

export async function getJson<T extends z.ZodType>(
  url: string,
  schema: T,
  options: Options
): Promise<z.infer<T>> {
  return schema.parse(await (await get(url, options)).json())
}

export async function getText(url: string, options: Options) {
  return (await get(url, options)).text()
}

/** Client-credentials token, kept for the life of the server instance. */
export function appToken(tokenUrl: string, id: string, secret: string) {
  let cached: { token: string; until: number } | null = null
  return async () => {
    if (cached && Date.now() < cached.until) return cached.token
    const res = await fetch(tokenUrl, {
      method: "POST",
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Token request failed: ${res.status}`)
    const body = (await res.json()) as { access_token: string; expires_in: number }
    cached = {
      token: body.access_token,
      until: Date.now() + (body.expires_in - 120) * 1000,
    }
    return cached.token
  }
}
