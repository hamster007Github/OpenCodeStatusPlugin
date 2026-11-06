import { Plugin } from "@opencode/plugin"
import { ProviderStatus } from "./rpc"
import { fetchStatus } from "./status/fetch"
import { resolveOptions } from "./status/options"
import { parsePayload } from "./status/parse"
import { scopeStatus } from "./status/select"
import type { StatusSnapshot, StatusView } from "./status/types"

/**
 * One poller per OpenCode server.
 *
 * It fetches the official status feed, validates it, keeps the last good
 * snapshot with its fetch time, and serves that cache over RPC. Windows render
 * the cache; they never fetch, and there is never one poller per window.
 */
export default Plugin.define({
  id: "provider-status",

  async setup(ctx) {
    const options = resolveOptions(ctx.options)
    const scope = { services: options.services, models: options.models }

    let snapshot: StatusSnapshot | null = null
    let fetchedAt: number | null = null
    let checkedAt: number | null = null
    let error: string | null = null
    let lastAttempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let inflight: Promise<void> | null = null
    let aborter: AbortController | null = null
    let closed = false
    let publish: ((state: string, at: number) => void) | null = null

    const view = (): StatusView => ({
      fetchedAt,
      checkedAt,
      staleAfterSeconds: options.staleAfterSeconds,
      intervalSeconds: options.intervalSeconds,
      apiUrl: options.apiUrl,
      snapshot,
      error,
    })

    const schedule = () => {
      if (closed) return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        void poll(false)
      }, options.intervalSeconds * 1000)
    }

    const poll = (force: boolean): Promise<void> => {
      if (closed) return Promise.resolve()
      if (inflight) return inflight

      const now = Date.now()
      if (!force && now - lastAttempt < 1000) return Promise.resolve()
      lastAttempt = now
      checkedAt = now

      const controller = new AbortController()
      aborter = controller

      inflight = (async () => {
        const result = await fetchStatus({ url: options.apiUrl, signal: controller.signal })

        if (closed) return

        if (!result.ok) {
          error = result.error
          return
        }

        const parsed = parsePayload(result.payload)

        if (!parsed) {
          error = "the status feed did not look like a status document"
          return
        }

        const at = Date.now()
        snapshot = parsed
        fetchedAt = at
        error = null

        // Publish after every successful poll, not only on a state change: a window that missed the
        // transition (or subscribed after a reload) still picks up the cache instead of staying cold.
        publish?.(scopeStatus(parsed, scope).state, at)
      })()
        .catch((cause: unknown) => {
          if (!closed) error = cause instanceof Error ? cause.message : "fetch failed"
        })
        .finally(() => {
          inflight = null
          aborter = null
          schedule()
        })

      return inflight
    }

    const registration = await ctx.rpc.register(ProviderStatus, {
      // A cold cache waits for the first poll: a window that reloads during a plugin restart gets
      // data instead of an empty view it would only correct on the next event, a minute later.
      snapshot: async () => {
        if (snapshot === null && error === null) await poll(true)
        return view()
      },
      refresh: async () => {
        await poll(true)
        return view()
      },
    })

    publish = (state, at) => {
      void registration.events.emit("changed", { at, state }).catch(() => undefined)
    }

    void poll(true)

    return () => {
      closed = true
      publish = null
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      aborter?.abort()
      aborter = null
    }
  },
})
