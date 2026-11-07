import type { Reason, State } from "./status/types"

/** A surface supplies its own dictionary lookup, so GUI and TUI share the words. */
export type Translate = (key: string) => string

export function stateWord(t: Translate, state: State): string {
  return t(`state.${state}`)
}

export function reasonWord(t: Translate, reason: Reason): string {
  return t(`reason.${reason}`)
}

/** A service id the copy does not know is shown as it came, never hidden. */
export function serviceLabel(t: Translate, service: string): string {
  const key = `service.${service}`
  const label = t(key)
  return label === key ? service : label
}

/** "Go", or "3 services": the pill stays one line. */
export function scopeLabel(t: Translate, services: readonly string[]): string {
  if (services.length === 1) return serviceLabel(t, services[0] ?? "")
  return `${services.length} ${t("pill.services")}`
}
