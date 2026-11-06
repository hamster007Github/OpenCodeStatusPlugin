import type { NotifyLevel, PrefsValue, ResolvedOptions, Scope, ServiceId } from "./types"
import { mergeLights, parseLights } from "./lights"

export const SERVICE_IDS = ["console", "logs", "inference", "go", "payg", "free"] as const

export const DEFAULT_API_URL = "https://status.opencode.ai/api/status"
export const STATUS_PAGE_URL = "https://status.opencode.ai"

/** The origin caches for 15 s; polling faster buys nothing and is rude. */
export const MIN_INTERVAL_SECONDS = 30
export const MAX_INTERVAL_SECONDS = 3600

export const NOTIFY_LEVELS: readonly NotifyLevel[] = ["off", "degraded", "outage"]

export function isServiceId(value: unknown): value is ServiceId {
  return typeof value === "string" && (SERVICE_IDS as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function seconds(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.round(value)))
}

function services(value: unknown, fallback: ServiceId[]): ServiceId[] {
  if (!Array.isArray(value)) return fallback
  const picked = value.filter(isServiceId)
  const unique = [...new Set(picked)]
  return unique.length > 0 ? unique : fallback
}

function models(value: unknown): ResolvedOptions["models"] {
  if (value === "all" || value === undefined || value === null) return "all"
  if (!Array.isArray(value)) return "all"
  const picked = [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim() !== "").map((id) => id.trim()))]
  return picked.length > 0 ? picked : "all"
}

function notify(value: unknown): NotifyLevel | null {
  return value === "off" || value === "degraded" || value === "outage" ? value : null
}

function endpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null

  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  // Plain HTTP is only for a local mirror; the real feed is HTTPS.
  if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)) return null
  return url.toString()
}

/** Turn the untrusted `options` of the plugin entry into a complete configuration. */
export function resolveOptions(raw: unknown): ResolvedOptions {
  const input = isRecord(raw) ? raw : {}
  const intervalSeconds = seconds(input.intervalSeconds, 60)
  const staleAfterSeconds = Math.max(intervalSeconds, seconds(input.staleAfterSeconds, 180))

  return {
    services: services(input.services, ["go"]),
    models: models(input.models),
    showSpeed: input.showSpeed !== false,
    showIncidents: input.showIncidents !== false,
    showHistory: input.showHistory !== false,
    intervalSeconds,
    staleAfterSeconds,
    notify: notify(input.notify) ?? "off",
    apiUrl: endpoint(input.apiUrl) ?? DEFAULT_API_URL,
    lights: mergeLights(parseLights(input.lights)),
  }
}

/**
 * The scope the pill and the panel use. The settings store wins over the plugin
 * options; at least one service and at least one model stay in scope.
 */
export function effectiveScope(options: ResolvedOptions, prefs: PrefsValue): Scope {
  const selected = services(prefs.services, options.services)
  const allModels = prefs.allModels ?? options.models === "all"
  const picked = Array.isArray(prefs.models) ? prefs.models : options.models === "all" ? [] : [...options.models]
  const filtered = [...new Set(picked.filter((id) => id.trim() !== "").map((id) => id.trim()))]

  return {
    services: selected,
    models: allModels || filtered.length === 0 ? "all" : filtered,
  }
}

export function notifyLevel(options: ResolvedOptions, prefs: PrefsValue): NotifyLevel {
  return notify(prefs.notify) ?? options.notify
}

export function showSpeed(options: ResolvedOptions, prefs: PrefsValue): boolean {
  return prefs.showSpeed ?? options.showSpeed
}

export function showIncidents(options: ResolvedOptions, prefs: PrefsValue): boolean {
  return prefs.showIncidents ?? options.showIncidents
}

export function showHistory(options: ResolvedOptions, prefs: PrefsValue): boolean {
  return prefs.showHistory ?? options.showHistory
}
