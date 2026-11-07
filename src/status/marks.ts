import type { Lights, State } from "./types"
import { DEFAULT_LIGHTS } from "./lights"

export type Tone = "success" | "warning" | "danger"

/**
 * One scale for every surface. A known degradation is a warning, an outage is
 * danger, and the unknown is a warning too: it must never read as healthy.
 */
export function toneOf(state: State): Tone {
  if (state === "outage") return "danger"
  if (state === "operational") return "success"
  return "warning"
}

/**
 * The mark a surface shows for a state. `lights` is configuration: the defaults
 * are the round lights, and a user may replace any of them with text or another
 * symbol. Stale outranks the state: old data is not a colour, it is a question.
 */
export function statusMark(state: State, stale: boolean, lights: Lights = DEFAULT_LIGHTS): string {
  return stale ? lights.stale : lights[state]
}
