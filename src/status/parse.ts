import type {
  HistoryBucket,
  Incident,
  IncidentNote,
  ModelHealth,
  Reason,
  ServiceHealth,
  Speed,
  State,
  StatusSnapshot,
  StatusView,
} from "./types"

const STATES: readonly string[] = ["operational", "degraded", "outage", "unknown"]
const REASONS: readonly string[] = ["none", "errors", "upstream", "latency", "availability", "unknown"]

// The payload is untrusted, so nothing below grows without a bound.
const MAX_SERVICES = 32
const MAX_MODELS = 256
const MAX_INCIDENTS = 20
const MAX_HISTORY = 56
const MAX_NOTES = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** An unknown state is `unknown`, which never reads as operational. */
export function asState(value: unknown): State {
  return typeof value === "string" && STATES.includes(value) ? (value as State) : "unknown"
}

export function asReason(value: unknown): Reason {
  return typeof value === "string" && REASONS.includes(value) ? (value as Reason) : "unknown"
}

function asSpeed(value: unknown): Speed | null {
  if (!isRecord(value)) return null
  const ttft = asNumber(value.ttft)
  const tps = asNumber(value.tps)
  if (ttft === null && tps === null) return null
  return { ttft, tps }
}

function asModel(value: unknown, fallback: { state: State; reason: Reason }): ModelHealth | null {
  if (typeof value === "string") {
    const id = asString(value)
    return id ? { id, state: fallback.state, reason: fallback.reason, speed: null } : null
  }

  if (!isRecord(value)) return null

  const id = asString(value.id)
  if (!id) return null

  return {
    id,
    state: asState(value.status),
    reason: asReason(value.reason),
    speed: asSpeed(value.speed),
  }
}

function asService(value: unknown): ServiceHealth | null {
  if (!isRecord(value)) return null

  const service = asString(value.service)
  if (!service) return null

  const state = asState(value.status)
  const reason = asReason(value.reason)

  const breakdown = asArray(value.breakdown)
  const listed = breakdown.length > 0 ? breakdown : asArray(value.models)
  const models: ModelHealth[] = []
  const seen = new Set<string>()

  for (const entry of listed.slice(0, MAX_MODELS)) {
    const model = asModel(entry, { state, reason })
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    models.push(model)
  }

  return {
    service,
    state,
    reason,
    since: asNumber(value.since),
    speed: asSpeed(value.speed),
    models,
  }
}

function noteIndex(value: unknown): Map<string, IncidentNote> {
  const notes = new Map<string, IncidentNote>()

  for (const entry of asArray(value).slice(0, MAX_NOTES)) {
    if (!isRecord(entry)) continue

    const event = asString(entry.event)
    const body = asString(entry.body)
    if (!event || !body) continue

    const at = asNumber(entry.at) ?? asNumber(entry.updatedAt)
    const current = notes.get(event)
    if (current && current.at !== null && at !== null && current.at >= at) continue
    notes.set(event, { at, body })
  }

  return notes
}

function asIncident(value: unknown, notes: Map<string, IncidentNote>): Incident | null {
  if (!isRecord(value)) return null

  // Only ongoing incidents are cached: the history strip covers the past.
  if (asNumber(value.resolvedAt) !== null) return null

  const event = asString(value.event)
  const id = asString(value.id) ?? event
  if (!id) return null

  const models: string[] = []
  for (const entry of asArray(value.models).slice(0, MAX_MODELS)) {
    const model = isRecord(entry) ? asString(entry.id) : asString(entry)
    if (model && !models.includes(model)) models.push(model)
  }

  return {
    id,
    service: asString(value.service) ?? "unknown",
    startedAt: asNumber(value.startedAt),
    state: asState(value.status),
    reason: asReason(value.reason),
    models,
    note: (event ? notes.get(event) : undefined) ?? null,
  }
}

function asHistory(value: unknown): HistoryBucket | null {
  if (!isRecord(value)) return null

  const start = asNumber(value.start)
  if (start === null) return null

  const services: Record<string, State> = {}
  if (isRecord(value.services)) {
    for (const [service, state] of Object.entries(value.services)) services[service] = asState(state)
  }

  const models: Record<string, Record<string, State>> = {}
  if (isRecord(value.models)) {
    for (const [service, perModel] of Object.entries(value.models)) {
      if (!isRecord(perModel)) continue
      const states: Record<string, State> = {}
      for (const [model, state] of Object.entries(perModel)) states[model] = asState(state)
      models[service] = states
    }
  }

  return { start, services, models }
}

function asHealthModel(value: unknown): ModelHealth | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  if (!id) return null

  return {
    id,
    state: asState(value.state),
    reason: asReason(value.reason),
    speed: asSpeed(value.speed),
  }
}

function asSnapshotService(value: unknown): ServiceHealth | null {
  if (!isRecord(value)) return null

  const service = asString(value.service)
  if (!service) return null

  const models: ModelHealth[] = []
  const seen = new Set<string>()

  for (const entry of asArray(value.models).slice(0, MAX_MODELS)) {
    const model = asHealthModel(entry)
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    models.push(model)
  }

  return {
    service,
    state: asState(value.state),
    reason: asReason(value.reason),
    since: asNumber(value.since),
    speed: asSpeed(value.speed),
    models,
  }
}

function asSnapshotIncident(value: unknown): Incident | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  if (!id) return null

  const models: string[] = []
  for (const entry of asArray(value.models).slice(0, MAX_MODELS)) {
    const model = asString(entry)
    if (model && !models.includes(model)) models.push(model)
  }

  const note = isRecord(value.note) ? asString(value.note.body) : null
  const at = isRecord(value.note) ? asNumber(value.note.at) : null

  return {
    id,
    service: asString(value.service) ?? "unknown",
    startedAt: asNumber(value.startedAt),
    state: asState(value.state),
    reason: asReason(value.reason),
    models,
    note: note ? { at, body: note } : null,
  }
}

/**
 * Validate a snapshot that already has the normalised shape, as the RPC returns it.
 *
 * The window must not run the upstream parser on it: `parsePayload` expects `components[]` and
 * `status`, so it would reject a valid cache and leave the panel empty.
 */
export function parseSnapshot(input: unknown): StatusSnapshot | null {
  if (!isRecord(input)) return null
  if (!Array.isArray(input.services)) return null

  const services: ServiceHealth[] = []
  const seen = new Set<string>()

  for (const entry of input.services.slice(0, MAX_SERVICES)) {
    const service = asSnapshotService(entry)
    if (!service || seen.has(service.service)) continue
    seen.add(service.service)
    services.push(service)
  }

  const incidents: Incident[] = []
  for (const entry of asArray(input.incidents)) {
    const incident = asSnapshotIncident(entry)
    if (!incident) continue
    incidents.push(incident)
    if (incidents.length >= MAX_INCIDENTS) break
  }

  const history: HistoryBucket[] = []
  for (const entry of asArray(input.history).slice(-MAX_HISTORY)) {
    const bucket = asHistory(entry)
    if (bucket) history.push(bucket)
  }
  history.sort((a, b) => a.start - b.start)

  return {
    updatedAt: asNumber(input.updatedAt),
    since: asNumber(input.since),
    stale: input.stale === true,
    state: asState(input.state),
    services,
    incidents,
    history,
  }
}

/**
 * Normalise the upstream payload. Returns `null` when the response is not a
 * status document at all, so the caller keeps its last good snapshot.
 */
export function parsePayload(input: unknown): StatusSnapshot | null {
  if (!isRecord(input)) return null
  if (!Array.isArray(input.components) && typeof input.status !== "string") return null

  const notes = noteIndex(input.notes)

  const services: ServiceHealth[] = []
  const seen = new Set<string>()
  for (const entry of asArray(input.components).slice(0, MAX_SERVICES)) {
    const service = asService(entry)
    if (!service || seen.has(service.service)) continue
    seen.add(service.service)
    services.push(service)
  }

  const incidents: Incident[] = []
  for (const entry of asArray(input.incidents)) {
    const incident = asIncident(entry, notes)
    if (!incident) continue
    incidents.push(incident)
    if (incidents.length >= MAX_INCIDENTS) break
  }

  const history: HistoryBucket[] = []
  for (const entry of asArray(input.history).slice(-MAX_HISTORY)) {
    const bucket = asHistory(entry)
    if (bucket) history.push(bucket)
  }
  history.sort((a, b) => a.start - b.start)

  return {
    updatedAt: asNumber(input.updatedAt),
    since: asNumber(input.since),
    stale: input.stale === true,
    state: asState(input.status),
    services,
    incidents,
    history,
  }
}

/**
 * Narrow an RPC result. The server already normalised the payload, but the
 * window still treats what it receives as data, not as truth.
 */
export function parseView(input: unknown): StatusView | null {
  if (!isRecord(input)) return null

  const staleAfterSeconds = asNumber(input.staleAfterSeconds)
  const intervalSeconds = asNumber(input.intervalSeconds)
  const apiUrl = asString(input.apiUrl)
  if (staleAfterSeconds === null || intervalSeconds === null || apiUrl === null) return null

  return {
    fetchedAt: asNumber(input.fetchedAt),
    checkedAt: asNumber(input.checkedAt),
    staleAfterSeconds,
    intervalSeconds,
    apiUrl,
    snapshot: input.snapshot === null || input.snapshot === undefined ? null : parseSnapshot(input.snapshot),
    error: asString(input.error),
  }
}
