import { describe, expect, test } from "bun:test"
import { pillLight, styles } from "../src/gui/theme"
import { DEFAULT_LIGHTS } from "../src/status/lights"

describe("pillLight", () => {
  test("is green, yellow and red for the three known states", () => {
    expect(pillLight("operational", false)).toBe("🟢")
    expect(pillLight("degraded", false)).toBe("🟡")
    expect(pillLight("outage", false)).toBe("🔴")
  })

  test("is a question mark emoji for unknown, and stale outranks the state", () => {
    expect(pillLight("unknown", false)).toBe("\u2754\uFE0F")
    expect(pillLight("operational", true)).toBe("\u2754\uFE0F")
    expect(pillLight("outage", true)).toBe("\u2754\uFE0F")
  })

  test("uses the configured mark for each state", () => {
    const lights = { ...DEFAULT_LIGHTS, degraded: "WARN", stale: "OLD" }

    expect(pillLight("degraded", false, lights)).toBe("WARN")
    expect(pillLight("outage", true, lights)).toBe("OLD")
    expect(styles.length).toBeGreaterThan(0)
  })
})
