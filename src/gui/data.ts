import { onCleanup, createSignal } from "solid-js"
import { createKeyed } from "@opencode/plugin/gui"
import { ProviderStatus } from "../rpc"
import { parseView } from "../status/parse"
import type { StatusView } from "../status/types"
import type { WindowContext } from "./definition"

export interface StatusController {
  /** The cache as the server last reported it, or `undefined` before the first answer. */
  view: () => StatusView | undefined
  busy: () => boolean
  reload: () => Promise<void>
  refresh: () => Promise<void>
  dispose: () => void
}

/**
 * The window side of the RPC: read the cache once, then again whenever the
 * server says the watched state changed. Refresh asks the server to poll; the
 * window itself never touches the status endpoint.
 */
export function createStatus(ctx: WindowContext, onView?: (view: StatusView) => void): StatusController {
  const [view, setView] = createSignal<StatusView | undefined>(undefined)
  const [busy, setBusy] = createSignal(false)

  let disposed = false

  const unreachable = (reason: string): StatusView => ({
    fetchedAt: null,
    checkedAt: Date.now(),
    staleAfterSeconds: 180,
    intervalSeconds: 60,
    apiUrl: "",
    snapshot: null,
    error: reason,
  })

  const describe = (cause: unknown): string =>
    cause instanceof Error && cause.message ? cause.message : "the OpenCode server did not answer"

  // The window's client is ready only once a session is routed. Passing the session's location is
  // what the published V2 plugins do; without it a call can target the wrong plugin instance.
  const callOptions = () => {
    const location = ctx.sessions.current()?.location
    return {
      signal: AbortSignal.timeout(20_000),
      ...(location ? { location } : {}),
    }
  }

  const reload = async () => {
    try {
      const next = parseView(await ctx.client.rpc(ProviderStatus).snapshot({}, callOptions()))

      if (!next) {
        if (view() === undefined) setView(unreachable("the server sent no status document"))
        return
      }

      setView(next)
      if (!disposed) onView?.(next)
    } catch (cause) {
      // A hung or failed read must not leave the panel spinning: show what we know, with the reason.
      if (view() === undefined || view()?.snapshot === null) setView(unreachable(describe(cause)))
    }
  }

  const refresh = async () => {
    if (busy()) return

    setBusy(true)

    try {
      const next = parseView(await ctx.client.rpc(ProviderStatus).refresh({}, callOptions()))

      if (next) {
        setView(next)
        if (!disposed) onView?.(next)
      }
    } catch (cause) {
      if (view() === undefined || view()?.snapshot === null) setView(unreachable(describe(cause)))
    }

    setBusy(false)
  }

  createKeyed(
    () => ctx.client,
    (client) => {
      const status = client.rpc(ProviderStatus)
      onCleanup(status.events.on("changed", () => void reload()))
    },
  )

  // Fetch when a session is routed, not at setup: the window's client is not ready before that.
  createKeyed(
    () => ctx.sessions.current()?.key,
    () => void reload(),
  )

  return {
    view,
    busy,
    reload,
    refresh,
    dispose: () => {
      disposed = true
    },
  }
}
