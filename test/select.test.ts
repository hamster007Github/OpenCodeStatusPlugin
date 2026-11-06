import { describe, expect, test } from "bun:test"
import { isStale, scopeStatus, worstState } from "../src/status/select"
import type { StatusSnapshot, StatusView } from "../src/status/types"

const snapshot: StatusSnapshot = {
  updatedAt: 1_700_000_000_000,
  since: 1_699_000_000_000,
  stale: false,
  state: "degraded",
  services: [
    {
      service: "go",
      state: "degraded",
      reason: "latency",
      since: 1_700_000_000_000,
      speed: { ttft: 2000, tps: 100 },
      models: [
        { id: "model-a", state: "operational", reason: "none", speed: null },
        { id: "model-b", state: "degraded", reason: "latency", speed: null },
      ],
    },
    {
      service: "free",
      state: "operational",
      reason: "none",
      since: null,
      speed: null,
      models: [{ id: "free-a", state: "operational", reason: "none", speed: null }],
    },
  ],
  incidents: [
    {
      id: "i1",
      service: "go",
      startedAt: 1,
      state: "degraded",
      reason: "latency",
      models: ["model-b"],
      note: null,
    },
    {
      id: "i2",
      service: "free",
      startedAt: 2,
      state: "outage",
      reason: "errors",
      models: [],
      note: null,
    },
  ],
  history: [
    { start: 1, services: { go: "operational", free: "outage" }, models: { go: { "model-a": "operational" } } },
    { start: 2, services: { go: "degraded" }, models: { go: { "model-a": "degraded" } } },
  ],
}

const view = (patch: Partial<StatusView> = {}): StatusView => ({
  fetchedAt: 1_700_000_000_000,
  checkedAt: 1_700_000_000_000,
  staleAfterSeconds: 180,
  intervalSeconds: 60,
  apiUrl: "https://status.opencode.ai/api/status",
  snapshot,
  error: null,
  ...patch,
})

describe("worstState", () => {
  test("ranks an outage above a degradation above the unknown", () => {
    expect(worstState(["operational", "degraded", "outage"])).toBe("outage")
    expect(worstState(["operational", "degraded"])).toBe("degraded")
    expect(worstState(["operational", "unknown"])).toBe("unknown")
    expect(worstState(["operational"])).toBe("operational")
  })

  test("an empty scope is unknown, never operational", () => {
    expect(worstState([])).toBe("unknown")
  })
})

describe("scopeStatus", () => {
  test("keeps only the watched services and their incidents", () => {
    const scoped = scopeStatus(snapshot, { services: ["go"], models: "all" })

    expect(scoped.services.map((service) => service.service)).toEqual(["go"])
    expect(scoped.incidents.map((incident) => incident.id)).toEqual(["i1"])
    expect(scoped.state).toBe("degraded")
  })

  test("filters models without hiding the service state", () => {
    const scoped = scopeStatus(snapshot, { services: ["go"], models: ["model-a"] })

    expect(scoped.models.map((model) => model.id)).toEqual(["model-a"])
    expect(scoped.state).toBe("degraded")
  })

  test("a missing service in a history bucket is unknown", () => {
    const scoped = scopeStatus(snapshot, { services: ["free"], models: "all" })

    expect(scoped.history.map((cell) => cell.state)).toEqual(["outage", "unknown"])
  })

  test("an empty scope stays unknown", () => {
    const scoped = scopeStatus(snapshot, { services: [], models: "all" })

    expect(scoped.state).toBe("unknown")
    expect(scoped.services).toEqual([])
  })
})

describe("isStale", () => {
  test("a fresh fetch within the threshold is not stale", () => {
    expect(isStale(view(), 1_700_000_000_000 + 60_000)).toBe(false)
  })

  test("an old fetch is stale", () => {
    expect(isStale(view(), 1_700_000_000_000 + 181_000)).toBe(true)
  })

  test("the origin's own stale flag wins", () => {
    expect(isStale(view({ snapshot: { ...snapshot, stale: true } }), 1_700_000_000_000)).toBe(true)
  })

  test("a failed check after a good one is stale, not healthy", () => {
    expect(
      isStale(
        view({ checkedAt: 1_700_000_000_000 + 5_000, error: "HTTP 503" }),
        1_700_000_000_000 + 6_000,
      ),
    ).toBe(true)
  })

  test("no snapshot is stale", () => {
    expect(isStale(view({ snapshot: null, fetchedAt: null }), 1)).toBe(true)
  })
})
