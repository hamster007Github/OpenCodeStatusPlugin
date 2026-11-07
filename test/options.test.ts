import { describe, expect, test } from "bun:test"
import { DEFAULT_API_URL, effectiveScope, notifyLevel, resolveOptions } from "../src/status/options"

describe("resolveOptions", () => {
  test("watches Go by default", () => {
    const options = resolveOptions(undefined)

    expect(options.services).toEqual(["go"])
    expect(options.models).toBe("all")
    expect(options.showSpeed).toBe(true)
    expect(options.showIncidents).toBe(true)
    expect(options.showHistory).toBe(true)
    expect(options.intervalSeconds).toBe(60)
    expect(options.staleAfterSeconds).toBe(180)
    expect(options.notify).toBe("off")
    expect(options.tuiHomeFooter).toBe(true)
    expect(options.tuiPromptFooter).toBe(true)
    expect(options.tuiNotify).toBe("off")
    expect(options.apiUrl).toBe(DEFAULT_API_URL)
  })

  test("enforces the poll floor and keeps staleness after the interval", () => {
    const options = resolveOptions({ intervalSeconds: 5, staleAfterSeconds: 10 })

    expect(options.intervalSeconds).toBe(30)
    expect(options.staleAfterSeconds).toBe(30)
  })

  test("keeps only known services and deduplicates them", () => {
    const options = resolveOptions({ services: ["go", "go", "chat", "inference"] })

    expect(options.services).toEqual(["go", "inference"])
  })

  test("falls back when no service is left", () => {
    expect(resolveOptions({ services: [] }).services).toEqual(["go"])
    expect(resolveOptions({ services: ["chat"] }).services).toEqual(["go"])
  })

  test("reads the model selection", () => {
    expect(resolveOptions({ models: ["a", "a", " "] }).models).toEqual(["a"])
    expect(resolveOptions({ models: [] }).models).toBe("all")
    expect(resolveOptions({ models: "all" }).models).toBe("all")
  })

  test("accepts a mirror only over HTTPS, or HTTP on this machine", () => {
    expect(resolveOptions({ apiUrl: "http://localhost:8080/status" }).apiUrl).toBe("http://localhost:8080/status")
    expect(resolveOptions({ apiUrl: "http://127.0.0.1:8080/status" }).apiUrl).toBe("http://127.0.0.1:8080/status")
    expect(resolveOptions({ apiUrl: "http://mirror.example/status" }).apiUrl).toBe(DEFAULT_API_URL)
    expect(resolveOptions({ apiUrl: "ftp://mirror.example/status" }).apiUrl).toBe(DEFAULT_API_URL)
    expect(resolveOptions({ apiUrl: "not a url" }).apiUrl).toBe(DEFAULT_API_URL)
  })

  test("ignores an unknown notification level", () => {
    expect(resolveOptions({ notify: "loud" }).notify).toBe("off")
    expect(resolveOptions({ notify: "outage" }).notify).toBe("outage")
  })

  test("reads the CLI surfaces and notification level separately", () => {
    const options = resolveOptions({ tuiHomeFooter: false, tuiPromptFooter: false, tuiNotify: "degraded" })

    expect(options.tuiHomeFooter).toBe(false)
    expect(options.tuiPromptFooter).toBe(false)
    expect(options.tuiNotify).toBe("degraded")
    expect(resolveOptions({ tuiNotify: "loud" }).tuiNotify).toBe("off")
  })
})

describe("effectiveScope", () => {
  const options = resolveOptions({ services: ["go"], models: "all" })

  test("follows the options without overrides", () => {
    expect(effectiveScope(options, {})).toEqual({ services: ["go"], models: "all" })
  })

  test("lets the settings store widen and narrow the scope", () => {
    const scope = effectiveScope(options, { services: ["go", "inference"], allModels: false, models: ["a"] })

    expect(scope).toEqual({ services: ["go", "inference"], models: ["a"] })
  })

  test("an empty service list falls back, an empty model list means all", () => {
    expect(effectiveScope(options, { services: [] })).toEqual({ services: ["go"], models: "all" })
    expect(effectiveScope(options, { allModels: false, models: [] })).toEqual({ services: ["go"], models: "all" })
  })

  test("a model list in the options is the default selection", () => {
    const picked = resolveOptions({ models: ["a", "b"] })

    expect(effectiveScope(picked, {}).models).toEqual(["a", "b"])
    expect(effectiveScope(picked, { allModels: true }).models).toBe("all")
  })
})

describe("notifyLevel", () => {
  const options = resolveOptions({ notify: "degraded" })

  test("the settings store wins", () => {
    expect(notifyLevel(options, {})).toBe("degraded")
    expect(notifyLevel(options, { notify: "off" })).toBe("off")
    expect(notifyLevel(options, { notify: "outage" })).toBe("outage")
    expect(notifyLevel(options, { notify: "loud" })).toBe("degraded")
  })
})

describe("lights", () => {
  test("defaults to the round lights", () => {
    const options = resolveOptions({})

    expect(options.lights.operational).toBe("🟢")
    expect(options.lights.degraded).toBe("🟡")
    expect(options.lights.outage).toBe("🔴")
    expect(options.lights.unknown).toBe("\u2754\uFE0F")
    expect(options.lights.stale).toBe("\u2754\uFE0F")
  })

  test("reads configured marks and ignores empty, long and unknown ones", () => {
    const options = resolveOptions({
      lights: { operational: "OK", outage: "   ", degraded: "x".repeat(40), bogus: "y" },
    })

    expect(options.lights.operational).toBe("OK")
    expect(options.lights.degraded).toBe("🟡")
    expect(options.lights.outage).toBe("🔴")
    expect(Object.keys(options.lights).sort()).toEqual(["degraded", "operational", "outage", "stale", "unknown"])
  })
})
