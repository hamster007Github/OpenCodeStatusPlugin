import type { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { ProviderStatus } from "../rpc"
import { resolveOptions } from "../status/options"
import { parseView } from "../status/parse"
import { isStale, scopeStatus } from "../status/select"
import type { ResolvedOptions, ScopedStatus, StatusView } from "../status/types"
import { maybeNotify } from "./notify"

export interface TuiStatusController {
  view: () => StatusView | undefined
  scoped: () => ScopedStatus | undefined
  stale: () => boolean
  busy: () => boolean
  options: ResolvedOptions
  reload: () => Promise<void>
  refresh: () => Promise<void>
  dispose: () => void
}

function unavailable(options: ResolvedOptions, reason: string): StatusView {
  return {
    fetchedAt: null,
    checkedAt: Date.now(),
    staleAfterSeconds: options.staleAfterSeconds,
    intervalSeconds: options.intervalSeconds,
    apiUrl: options.apiUrl,
    snapshot: null,
    error: reason,
  }
}

/**
 * The TUI side of the RPC. It reads the server's cache, subscribes to the
 * `changed` event and never fetches the status endpoint itself.
 */
export function createStatus(context: Plugin.Context): TuiStatusController {
  const options = resolveOptions(context.options)
  const [view, setView] = createSignal<StatusView | undefined>(undefined)
  const [busy, setBusy] = createSignal(false)

  let disposed = false
  let inflight: Promise<void> | null = null

  const location = () => context.location ?? context.data.location.default()
  const callOptions = () => ({ location: location() })

  const scoped = () => {
    const current = view()
    if (!current?.snapshot) return undefined
    return scopeStatus(current.snapshot, { services: options.services, models: options.models })
  }

  const stale = () => {
    const current = view()
    return current ? isStale(current, Date.now()) : true
  }

  const read = (method: "snapshot" | "refresh"): Promise<void> => {
    if (disposed) return Promise.resolve()
    // A snapshot read coalesces with one already in flight; a forced refresh does not.
    if (inflight && method === "snapshot") return inflight

    setBusy(true)
    const status = context.client.rpc(ProviderStatus)
    const request = method === "snapshot" ? status.snapshot({}, callOptions()) : status.refresh({}, callOptions())

    inflight = (async () => {
      try {
        const next = parseView(await request)
        if (disposed) return

        if (!next) {
          setView(unavailable(options, "the server returned an invalid status view"))
          return
        }

        setView(next)
        maybeNotify(context, next, options)
      } catch (cause) {
        if (disposed) return
        setView(unavailable(options, cause instanceof Error ? cause.message : "status unavailable"))
      }
    })().finally(() => {
      inflight = null
      setBusy(false)
    })

    return inflight
  }

  const off = context.client.rpc(ProviderStatus).events.on("changed", () => {
    void read("snapshot")
  })

  void read("snapshot")

  return {
    view,
    scoped,
    stale,
    busy,
    options,
    reload: () => read("snapshot"),
    refresh: () => read("refresh"),
    dispose: () => {
      disposed = true
      off()
    },
  }
}
