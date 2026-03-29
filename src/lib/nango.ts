const BASE_URL = () => {
  const url = process.env.NANGO_BASE_URL
  if (!url) throw new Error('NANGO_BASE_URL is not set')
  return url.replace(/\/$/, '')
}

const SECRET = () => {
  const key = process.env.NANGO_SECRET_KEY
  if (!key) throw new Error('NANGO_SECRET_KEY is not set')
  return key
}

function nangoHeaders(connectionId: string, integration: string): HeadersInit {
  return {
    'Authorization':       `Bearer ${SECRET()}`,
    'Connection-Id':       connectionId,
    'Provider-Config-Key': integration,
    'Content-Type':        'application/json',
  }
}

export async function nangoGet(
  connectionId: string,
  integration: string,
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${BASE_URL()}/proxy${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString(), {
    method:  'GET',
    headers: nangoHeaders(connectionId, integration),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Nango proxy GET ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function nangoPost(
  connectionId: string,
  integration: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${BASE_URL()}/proxy${path}`, {
    method:  'POST',
    headers: nangoHeaders(connectionId, integration),
    body:    JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Nango proxy POST ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}
