import type { Reason, State } from "../status/types"
import type { WindowContext } from "./definition"

export function stateWord(ctx: WindowContext, state: State): string {
  return ctx.t(`state.${state}`)
}

export function reasonWord(ctx: WindowContext, reason: Reason): string {
  return ctx.t(`reason.${reason}`)
}

/** A service id the copy does not know is shown as it came, never hidden. */
export function serviceLabel(ctx: WindowContext, service: string): string {
  const key = `service.${service}`
  const label = ctx.t(key)
  return label === key ? service : label
}

/** "Go", or "3 services": the pill stays one line. */
export function scopeLabel(ctx: WindowContext, services: readonly string[]): string {
  if (services.length === 1) return serviceLabel(ctx, services[0] ?? "")
  return `${services.length} ${ctx.t("pill.services")}`
}
