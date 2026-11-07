import { RANK, scopeStatus } from "../status/select"
import { effectiveScope, notifyLevel, resolveOptions } from "../status/options"
import type { StatusView } from "../status/types"
import { serviceLabel, stateWord } from "../copy"
import { readPrefs } from "./prefs"
import type { WindowContext } from "./definition"

/** The last notification this window sent, so a reload does not repeat it. */
let lastNotice: string | null = null

/**
 * Notifications are opt-in, limited to the watched scope, and deduplicated by
 * the `id` the app uses: only the first window to send an id notifies.
 */
export function maybeNotify(ctx: WindowContext, view: StatusView): void {
  if (view.snapshot === null) return

  const options = resolveOptions(ctx.options)
  const level = notifyLevel(options, readPrefs(ctx))

  if (level === "off") return

  const scoped = scopeStatus(view.snapshot, effectiveScope(options, readPrefs(ctx)))
  const threshold = level === "outage" ? RANK.outage : RANK.degraded

  if (RANK[scoped.state] < threshold) {
    lastNotice = null
    return
  }

  const subject = scoped.services.find((service) => RANK[service.state] >= threshold)

  if (!subject) return

  // A new `since` is a new incident; the same state keeps its id.
  const id = `${ctx.id}:${subject.service}:${subject.since ?? scoped.state}`

  if (id === lastNotice) return
  lastNotice = id

  void ctx.attention.notify({
    id,
    title: ctx.t("plugin.title"),
    message: `${serviceLabel(ctx.t, subject.service)} ${stateWord(ctx.t, subject.state)}`,
    variant: scoped.state === "outage" ? "error" : "default",
  })
}
