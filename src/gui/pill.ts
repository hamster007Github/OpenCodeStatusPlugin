import { effectiveScope, resolveOptions } from "../status/options"
import { mergeLights } from "../status/lights"
import { isStale, scopeStatus } from "../status/select"
import { statusMark, toneOf, type Tone } from "../status/marks"
import { reasonWord, scopeLabel, serviceLabel, stateWord } from "../copy"
import type { StatusController } from "./data"
import { readPrefs } from "./prefs"
import type { WindowContext } from "./definition"

export interface PillRow {
  id: string
  label: string
  detail?: string
  icon?: "circle-check" | "status"
  tone?: Tone
  run?: () => void
}

export interface PillView {
  label: string
  title: string
  rows: PillRow[]
}

/**
 * The pill answers one question: is the watched scope healthy right now?
 *
 * Its menu lists the watched services with their state and reason, so a broken
 * service is one click from the answer. Per-model state and the speed numbers
 * live in the panel, where they have room and units.
 */
export function buildPill(
  ctx: WindowContext,
  status: StatusController,
  open: () => void,
): PillView | undefined {
  const view = status.view()

  // Before the first answer there is nothing true to say, so the pill stays away. The same holds
  // while the first poll runs: an unknown pill for two seconds is noise, not information.
  if (!view) return undefined
  if (view.snapshot === null && view.error === null) return undefined

  const options = resolveOptions(ctx.options)
  const prefs = readPrefs(ctx)
  const scope = effectiveScope(options, prefs)
  const lights = mergeLights(options.lights, prefs.lights)
  const scoped = view.snapshot ? scopeStatus(view.snapshot, scope) : undefined
  const stale = isStale(view, Date.now())
  const state = scoped?.state ?? "unknown"
  const brand = ctx.t("pill.brand")
  const name = scopeLabel(ctx.t, scope.services)

  // The capsule is a scope and a round light, under the product name. The words live in the
  // accessible name and the menu heading, so the pill still says "degraded" to a screen reader.
  const words = [brand, name, stateWord(ctx.t, state)]
  if (stale) words.push(ctx.t("state.stale"))

  const rows: PillRow[] = (scoped?.services ?? []).map((service) => ({
    id: service.service,
    label: serviceLabel(ctx.t, service.service),
    detail:
      service.reason === "none"
        ? stateWord(ctx.t, service.state)
        : `${stateWord(ctx.t, service.state)} · ${reasonWord(ctx.t, service.reason)}`,
    icon: service.state === "operational" ? "circle-check" : "status",
    tone: toneOf(service.state),
  }))

  rows.push({ id: "open", label: ctx.t("pill.open"), icon: "status", run: open })

  return {
    label: `${brand} [${name}] ${statusMark(state, stale, lights)}`,
    title: words.join(" · "),
    rows,
  }
}
