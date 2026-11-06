import type { HistoryBucket, Scope, ScopedService, ScopedStatus, State, StatusSnapshot, StatusView } from "./types"

/** Severity order: a known outage outranks a known degradation, which outranks the unknown. */
export const RANK: Record<State, number> = {
  operational: 0,
  unknown: 1,
  degraded: 2,
  outage: 3,
}

/** The worst state of a list; an empty list is unknown, never operational. */
export function worstState(states: readonly State[]): State {
  let worst: State | null = null

  for (const state of states) {
    if (worst === null || RANK[state] > RANK[worst]) worst = state
  }

  return worst ?? "unknown"
}

function historyState(bucket: HistoryBucket, scope: Scope): State {
  const states: State[] = []

  for (const service of scope.services) {
    if (scope.models === "all") {
      states.push(bucket.services[service] ?? "unknown")
      continue
    }

    const perModel = bucket.models[service]
    for (const id of scope.models) {
      states.push(perModel?.[id] ?? bucket.services[service] ?? "unknown")
    }
  }

  return worstState(states)
}

/** Reduce a snapshot to the watched scope. */
export function scopeStatus(snapshot: StatusSnapshot, scope: Scope): ScopedStatus {
  const watched = new Set(scope.services)
  const services: ScopedService[] = []

  for (const service of snapshot.services) {
    if (!watched.has(service.service)) continue

    const models = service.models.filter((model) => scope.models === "all" || scope.models.includes(model.id))
    services.push({ ...service, models })
  }

  const models = services.flatMap((service) => service.models.map((model) => ({ ...model, service: service.service })))

  return {
    state: worstState([...services.map((service) => service.state), ...models.map((model) => model.state)]),
    services,
    models,
    incidents: snapshot.incidents.filter((incident) => watched.has(incident.service)),
    history: snapshot.history.map((bucket) => ({ start: bucket.start, state: historyState(bucket, scope) })),
  }
}

/**
 * Staleness is decided where it is read: a snapshot the server fetched long
 * enough ago, or one the origin itself flagged, is stale.
 */
export function isStale(view: StatusView, now: number): boolean {
  if (view.snapshot === null || view.fetchedAt === null) return true
  if (view.snapshot.stale) return true
  if (view.error !== null && view.checkedAt !== null && view.fetchedAt < view.checkedAt) return true
  return now - view.fetchedAt > view.staleAfterSeconds * 1000
}
