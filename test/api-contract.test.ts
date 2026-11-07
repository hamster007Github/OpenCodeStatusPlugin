import { describe, expect, test } from "bun:test"
import { SERVICE_IDS } from "../src/status/options"
import { validateContract } from "../scripts/contract"

const now = Date.now()

function component(service: string, overrides: Record<string, unknown> = {}) {
  return {
    service,
    status: "operational",
    reason: "none",
    since: now - 60_000,
    models: [],
    breakdown: [
      { id: `${service}-model`, status: "operational", reason: "none", speed: { ttft: 1_200, tps: 140 } },
    ],
    speed: { ttft: 1_200, tps: 140 },
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    updatedAt: now,
    since: now - 60_000,
    stale: false,
    status: "operational",
    components: SERVICE_IDS.map((service) => component(service)),
    incidents: [],
    notes: [],
    history: [
      {
        start: now - 3 * 3_600_000,
        services: { go: "operational" },
        models: { go: { "go-model": "operational" } },
      },
    ],
    ...overrides,
  }
}

function clone(input: unknown): any {
  return structuredClone(input)
}

describe("the live API contract", () => {
  test("accepts the documented shape", () => {
    const result = validateContract(payload())

    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.info.services).toBe(SERVICE_IDS.length)
    expect(result.info.models).toBe(SERVICE_IDS.length)
    expect(result.info.history).toBe(1)
  })

  test("rejects a missing or empty component list", () => {
    expect(validateContract(payload({ components: undefined })).errors).toContain("components[] is missing or empty")
    expect(validateContract(payload({ components: [] })).errors).toContain("components[] is missing or empty")
  })

  test("rejects missing history", () => {
    expect(validateContract(payload({ history: [] })).errors).toContain("history[] is missing or empty")
  })

  test("rejects a non-numeric updatedAt", () => {
    expect(validateContract(payload({ updatedAt: "yesterday" })).errors).toContain(
      "updatedAt is missing or not a number",
    )
  })

  test("rejects a changed speed type", () => {
    const broken = clone(payload())
    broken.components.find((entry: any) => entry.service === "go").breakdown[0].speed.ttft = "fast"

    const result = validateContract(broken)
    expect(result.errors.some((error) => error.includes("speed.ttft"))).toBe(true)
  })

  test("rejects a missing go service", () => {
    const result = validateContract(
      payload({ components: SERVICE_IDS.filter((service) => service !== "go").map((service) => component(service)) }),
    )

    expect(result.errors).toContain("the go service is missing")
  })

  test("warns about a new service", () => {
    const extra = clone(payload())
    extra.components.push(component("new-service"))

    const result = validateContract(extra)
    expect(result.errors).toEqual([])
    expect(result.warnings).toContain("new service: new-service")
  })

  test("warns about a new state", () => {
    const changed = clone(payload())
    changed.components.find((entry: any) => entry.service === "go").status = "maintenance"

    const result = validateContract(changed)
    expect(result.errors).toEqual([])
    expect(result.warnings).toContain("new state value: maintenance")
  })

  test("warns about a new reason", () => {
    const changed = clone(payload())
    changed.components.find((entry: any) => entry.service === "go").reason = "throttled"

    const result = validateContract(changed)
    expect(result.errors).toEqual([])
    expect(result.warnings).toContain("new reason value: throttled")
  })

  test("does not treat an outage as a contract failure", () => {
    const down = clone(payload())
    down.status = "outage"
    for (const entry of down.components) entry.status = "outage"

    expect(validateContract(down).errors).toEqual([])
  })

  test("warns when the overall status disappears", () => {
    const result = validateContract(payload({ status: undefined }))

    expect(result.errors).toEqual([])
    expect(result.warnings).toContain("overall status is missing")
  })

  test("accepts empty incidents, notes and speed objects", () => {
    const quiet = clone(payload())
    const go = quiet.components.find((entry: any) => entry.service === "go")
    go.speed = {}
    go.breakdown[0].speed = {}

    expect(validateContract(quiet).errors).toEqual([])
  })

  test("accepts an empty breakdown on a non-model service", () => {
    const partial = clone(payload())
    partial.components.find((entry: any) => entry.service === "console").breakdown = []

    expect(validateContract(partial).errors).toEqual([])
  })

  test("rejects an empty breakdown on go", () => {
    const broken = clone(payload())
    broken.components.find((entry: any) => entry.service === "go").breakdown = []

    expect(validateContract(broken).errors).toContain("go: breakdown[] is empty")
  })
})
