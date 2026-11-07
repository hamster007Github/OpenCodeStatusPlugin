import { describe, expect, test } from "bun:test"
import { styles } from "../src/gui/theme"
import { statusMark } from "../src/status/marks"
import { DEFAULT_LIGHTS } from "../src/status/lights"

describe("statusMark", () => {
  test("is green, yellow and red for the three known states", () => {
    expect(statusMark("operational", false)).toBe("🟢")
    expect(statusMark("degraded", false)).toBe("🟡")
    expect(statusMark("outage", false)).toBe("🔴")
  })

  test("is a question mark emoji for unknown, and stale outranks the state", () => {
    expect(statusMark("unknown", false)).toBe("\u2754\uFE0F")
    expect(statusMark("operational", true)).toBe("\u2754\uFE0F")
    expect(statusMark("outage", true)).toBe("\u2754\uFE0F")
  })

  test("uses the configured mark for each state", () => {
    const lights = { ...DEFAULT_LIGHTS, degraded: "WARN", stale: "OLD" }

    expect(statusMark("degraded", false, lights)).toBe("WARN")
    expect(statusMark("outage", true, lights)).toBe("OLD")
    expect(styles.length).toBeGreaterThan(0)
  })
})
