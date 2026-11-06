/**
 * The status domain, independent of OpenCode and of the transport.
 *
 * Everything here treats the upstream feed as untrusted input: a state the
 * domain does not know is `unknown`, never `operational`.
 */

/** Overall, per-service and per-model state. */
export type State = "operational" | "degraded" | "outage" | "unknown"

/** Why a service or model is not operational. `unknown` means unreadable. */
export type Reason = "none" | "errors" | "upstream" | "latency" | "availability" | "unknown"

/** Median timings over the last five minutes. A field is `null` when unreported. */
export interface Speed {
  ttft: number | null
  tps: number | null
}

export interface ModelHealth {
  id: string
  state: State
  reason: Reason
  speed: Speed | null
}

export interface ServiceHealth {
  service: string
  state: State
  reason: Reason
  /** First observation of the current state, in ms since the epoch. */
  since: number | null
  speed: Speed | null
  models: ModelHealth[]
}

export interface IncidentNote {
  at: number | null
  body: string
}

export interface Incident {
  id: string
  service: string
  startedAt: number | null
  state: State
  reason: Reason
  models: string[]
  note: IncidentNote | null
}

/** One three-hour period of the origin's seven-day history. */
export interface HistoryBucket {
  start: number
  services: Record<string, State>
  models: Record<string, Record<string, State>>
}

/** The normalised snapshot the server caches. */
export interface StatusSnapshot {
  /** Snapshot time from the origin. */
  updatedAt: number | null
  /** First observation of the overall state, from the origin. */
  since: number | null
  /** The origin's own stale flag. */
  stale: boolean
  state: State
  services: ServiceHealth[]
  incidents: Incident[]
  history: HistoryBucket[]
}

/** What the window receives over RPC: the cache and its age, never a live fetch. */
export interface StatusView {
  /** When the last successful fetch happened, or `null` if there was none. */
  fetchedAt: number | null
  /** When the poller last tried, successful or not. */
  checkedAt: number | null
  staleAfterSeconds: number
  intervalSeconds: number
  apiUrl: string
  snapshot: StatusSnapshot | null
  /** The last fetch failure, in human-readable form. */
  error: string | null
}

/** Which services and models the user cares about. */
export interface Scope {
  services: string[]
  /** `"all"`, or the model ids to watch within the selected services. */
  models: "all" | readonly string[]
}

export interface ScopedModel extends ModelHealth {
  service: string
}

export interface ScopedService extends Omit<ServiceHealth, "models"> {
  models: ModelHealth[]
}

/** A snapshot reduced to the watched scope. */
export interface ScopedStatus {
  state: State
  services: ScopedService[]
  models: ScopedModel[]
  incidents: Incident[]
  history: Array<{ start: number; state: State }>
}

export type ServiceId = "console" | "logs" | "inference" | "go" | "payg" | "free"

/** The pill shows one mark per state, plus one for stale data. */
export type LightKey = State | "stale"

export type Lights = Record<LightKey, string>

/** When the plugin may interrupt the user. */
export type NotifyLevel = "off" | "degraded" | "outage"

export type ModelSelection = "all" | readonly string[]

/** The plugin options after validation. */
export interface ResolvedOptions {
  services: ServiceId[]
  models: ModelSelection
  showSpeed: boolean
  showIncidents: boolean
  showHistory: boolean
  intervalSeconds: number
  staleAfterSeconds: number
  notify: NotifyLevel
  apiUrl: string
  lights: Lights
}

/**
 * The part of the settings store this plugin reads. Every field is optional:
 * a missing field follows the plugin options.
 */
export interface PrefsValue {
  services?: string[]
  models?: string[]
  allModels?: boolean
  showSpeed?: boolean
  showIncidents?: boolean
  showHistory?: boolean
  notify?: string
  lights?: Partial<Lights>
}

