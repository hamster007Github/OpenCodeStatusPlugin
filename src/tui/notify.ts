import type { Plugin } from "@opencode/plugin/tui"
import { serviceLabel, stateWord } from "../copy"
import { RANK, scopeStatus } from "../status/select"
import type { ResolvedOptions, StatusView } from "../status/types"
import { t } from "./copy"

/**
 * The last CLI notification, so the once-a-minute poll does not repeat it.
 * The id follows the desktop rule: a new `since` is a new incident.
 */
let lastNotice: string | null = null

export function maybeNotify(context: Plugin.Context, view: StatusView, options: ResolvedOptions): void {
  if (options.tuiNotify === "off" || view.snapshot === null) return

  const scoped = scopeStatus(view.snapshot, { services: options.services, models: options.models })
  const threshold = options.tuiNotify === "outage" ? RANK.outage : RANK.degraded

  if (RANK[scoped.state] < threshold) {
    lastNotice = null
    return
  }

  const subject = scoped.services.find((service) => RANK[service.state] >= threshold)
  if (!subject) return

  const id = `provider-status-tui:${subject.service}:${subject.since ?? scoped.state}`
  if (id === lastNotice) return
  lastNotice = id

  void context.attention.notify({
    title: t("plugin.title"),
    message: `${serviceLabel(t, subject.service)} ${stateWord(t, subject.state)}`,
    // A notification while the user is looking at the TUI is noise; the footer already moved.
    notification: { when: "blurred" },
  })
}
