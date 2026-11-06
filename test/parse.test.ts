import { describe, expect, test } from "bun:test"
import { parsePayload, parseView } from "../src/status/parse"

const payload = {
  updatedAt: 1_700_000_000_000,
  since: 1_699_000_000_000,
  stale: false,
  status: "degraded",
  components: [
    {
      service: "go",
      status: "degraded",
      reason: "latency",
      since: 1_700_000_000_000,
      models: [],
      breakdown: [
        { id: "model-a", status: "operational", reason: "none", speed: { ttft: 1200, tps: 90 } },
        { id: "model-b", status: "degraded", reason: "latency", speed: { ttft: 4000 } },
      ],
      speed: { ttft: 2000, tps: 100 },
    },
    { service: "free", status: "operational", reason: "none", since: 0, models: [], breakdown: [], speed: {} },
  ],
  incidents: [
    {
      id: "i1",
      event: "i1",
      service: "go",
      startedAt: 1_700_000_000_000,
      resolvedAt: null,
      status: "degraded",
      reason: "latency",
      models: [{ id: "model-b" }],
    },
    {
      id: "i2",
      event: "i2",
      service: "go",
      startedAt: 1,
      resolvedAt: 2,
      status: "degraded",
      reason: "errors",
      models: [],
    },
  ],
  notes: [
    { event: "i1", body: "older update", at: 1 },
    { event: "i1", body: "latest update", at: 5 },
  ],
  history: [
    { start: 2, services: { go: "operational" }, models: { go: { "model-a": "operational" } } },
    { start: 1, services: { go: "degraded" }, models: { go: { "model-a": "degraded" } } },
  ],
}

describe("parsePayload", () => {
  test("normalises the feed", () => {
    const snapshot = parsePayload(payload)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.state).toBe("degraded")
    expect(snapshot?.updatedAt).toBe(1_700_000_000_000)
    expect(snapshot?.services).toHaveLength(2)

    const go = snapshot?.services[0]
    expect(go?.service).toBe("go")
    expect(go?.reason).toBe("latency")
    expect(go?.speed).toEqual({ ttft: 2000, tps: 100 })
    expect(go?.models.map((model) => model.id)).toEqual(["model-a", "model-b"])
    expect(go?.models[0]?.speed).toEqual({ ttft: 1200, tps: 90 })
    expect(go?.models[1]?.speed).toEqual({ ttft: 4000, tps: null })
  })

  test("keeps only ongoing incidents and attaches the latest update", () => {
    const snapshot = parsePayload(payload)

    expect(snapshot?.incidents).toHaveLength(1)
    expect(snapshot?.incidents[0]?.id).toBe("i1")
    expect(snapshot?.incidents[0]?.models).toEqual(["model-b"])
    expect(snapshot?.incidents[0]?.note?.body).toBe("latest update")
  })

  test("sorts history and keeps every bucket", () => {
    const snapshot = parsePayload(payload)

    expect(snapshot?.history.map((bucket) => bucket.start)).toEqual([1, 2])
  })

  test("never turns an unknown state into operational", () => {
    const snapshot = parsePayload({
      status: "operational-ish",
      components: [{ service: "go", status: "melted", reason: "cosmic" }],
    })

    expect(snapshot?.state).toBe("unknown")
    expect(snapshot?.services[0]?.state).toBe("unknown")
    expect(snapshot?.services[0]?.reason).toBe("unknown")
    expect(snapshot?.services[0]?.models).toEqual([])
  })

  test("degrades a missing status to unknown instead of healthy", () => {
    const snapshot = parsePayload({ components: [{ service: "go" }] })

    expect(snapshot).not.toBeNull()
    expect(snapshot?.state).toBe("unknown")
    expect(snapshot?.services[0]?.state).toBe("unknown")
    expect(snapshot?.services[0]?.since).toBeNull()
    expect(snapshot?.services[0]?.speed).toBeNull()
  })

  test("reads the legacy model list when there is no breakdown", () => {
    const snapshot = parsePayload({ status: "outage", components: [{ service: "go", status: "outage", models: ["a"] }] })

    expect(snapshot?.services[0]?.models).toEqual([{ id: "a", state: "outage", reason: "unknown", speed: null }])
  })

  test("drops entries without an id or a service", () => {
    const snapshot = parsePayload({
      status: "operational",
      components: [{ service: "go", breakdown: [{ status: "operational" }] }, { status: "operational" }],
    })

    expect(snapshot?.services).toHaveLength(1)
    expect(snapshot?.services[0]?.models).toEqual([])
  })

  test("rejects a response that is not a status document", () => {
    expect(parsePayload(null)).toBeNull()
    expect(parsePayload({ hello: "world" })).toBeNull()
    expect(parsePayload("upstream maintenance")).toBeNull()
  })
})

describe("parseView", () => {
  test("keeps a snapshot that is already normalised, as the RPC returns it", () => {
    const snapshot = parsePayload(payload)
    const view = parseView({
      fetchedAt: 10,
      checkedAt: 10,
      staleAfterSeconds: 180,
      intervalSeconds: 60,
      apiUrl: "https://status.opencode.ai/api/status",
      error: null,
      snapshot,
    })

    expect(view?.snapshot?.state).toBe("degraded")
    expect(view?.snapshot?.services.map((service) => service.service)).toEqual(["go", "free"])
    expect(view?.snapshot?.history).toHaveLength(2)
  })
  test("narrows the RPC view and degrades a broken snapshot", () => {
    const view = parseView({
      fetchedAt: 10,
      checkedAt: 12,
      staleAfterSeconds: 180,
      intervalSeconds: 60,
      apiUrl: "https://status.opencode.ai/api/status",
      error: null,
      snapshot: { nope: true },
    })

    expect(view?.fetchedAt).toBe(10)
    expect(view?.snapshot).toBeNull()
  })

  test("rejects a view without its envelope", () => {
    expect(parseView({ fetchedAt: 1 })).toBeNull()
    expect(parseView(undefined)).toBeNull()
  })
})
