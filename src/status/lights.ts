import type { LightKey, Lights } from "./types"

/**
 * The marks the pill shows. They are configuration, not code: a user may prefer words, ASCII,
 * symbols from another set, or nothing at all. The defaults are the round lights this project ships.
 */
export const LIGHT_KEYS: readonly LightKey[] = ["operational", "degraded", "outage", "unknown", "stale"]

export const DEFAULT_LIGHTS: Lights = {
  operational: "🟢",
  degraded: "🟡",
  outage: "🔴",
  unknown: "❔️",
  stale: "❔️",
}

/** Long enough for a word, short enough that the pill stays one line. */
const MAX_LIGHT_LENGTH = 24

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Read the valid entries of a `lights` object; empty, too long and unknown keys are ignored. */
export function parseLights(value: unknown): Partial<Lights> {
  if (!isRecord(value)) return {}

  const lights: Partial<Lights> = {}

  for (const key of LIGHT_KEYS) {
    const raw = value[key]
    if (typeof raw !== "string") continue

    const text = raw.trim()
    if (text.length === 0 || text.length > MAX_LIGHT_LENGTH) continue

    lights[key] = text
  }

  return lights
}

/** Defaults first, then each layer that has a value. Later layers win. */
export function mergeLights(...layers: Array<Partial<Lights> | undefined>): Lights {
  const lights: Lights = { ...DEFAULT_LIGHTS }

  for (const layer of layers) {
    if (!layer) continue
    for (const key of LIGHT_KEYS) {
      const text = layer[key]
      if (text) lights[key] = text
    }
  }

  return lights
}
