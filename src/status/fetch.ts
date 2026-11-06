/**
 * The only place the plugin talks to the network.
 *
 * The status endpoint sends no CORS header, so this runs in the server part
 * (Node) and never in a window. No credentials are sent, and no HTML is read:
 * the JSON endpoint is the only source.
 */

export type FetchResult = { ok: true; payload: unknown } | { ok: false; error: string }

const DEFAULT_TIMEOUT_MS = 10_000

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return "timed out"
    return error.message
  }
  return "request failed"
}

export async function fetchStatus(input: {
  url: string
  signal?: AbortSignal | undefined
  timeoutMs?: number
}): Promise<FetchResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const forward = () => controller.abort()

  if (input.signal?.aborted) controller.abort()
  input.signal?.addEventListener("abort", forward, { once: true })

  try {
    const response = await fetch(input.url, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }

    return { ok: true, payload: await response.json() }
  } catch (error) {
    return { ok: false, error: describe(error) }
  } finally {
    clearTimeout(timeout)
    input.signal?.removeEventListener("abort", forward)
  }
}
