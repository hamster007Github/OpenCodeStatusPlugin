import type { JsonSchema } from "effect"
import { Rpc } from "@opencode/plugin/rpc"

/**
 * The contract between the server part and the desktop windows.
 *
 * The server owns the poller and the cache; a window asks for the cache and
 * asks for a refresh, and never fetches the status endpoint itself.
 *
 * The schemas below check the envelope only. The status document inside
 * `snapshot` is untrusted input, so `src/status/parse.ts` normalises it on
 * both sides instead of a schema repeating its shape.
 */
const EMPTY: JsonSchema.JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
}

const VIEW: JsonSchema.JsonSchema = {
  type: "object",
  properties: {
    fetchedAt: { type: ["number", "null"] },
    checkedAt: { type: ["number", "null"] },
    staleAfterSeconds: { type: "number" },
    intervalSeconds: { type: "number" },
    apiUrl: { type: "string" },
    error: { type: ["string", "null"] },
    snapshot: { type: ["object", "null"] },
  },
  required: ["fetchedAt", "checkedAt", "staleAfterSeconds", "intervalSeconds", "apiUrl", "error", "snapshot"],
  additionalProperties: false,
}

const CHANGED: JsonSchema.JsonSchema & { type: "object" } = {
  type: "object",
  properties: {
    at: { type: "number" },
    state: { type: "string" },
  },
  required: ["at", "state"],
  additionalProperties: false,
}

export const ProviderStatus = Rpc.define({
  id: "provider-status",
  methods: {
    /** The cache as the server holds it. A cold cache waits for the first poll. */
    snapshot: { input: EMPTY, output: VIEW },

    /** Force one fetch, then return the cache. Coalesced with the poller. */
    refresh: { input: EMPTY, output: VIEW },
  },
  events: {
    /** Emitted after each successful poll, so a window can refresh its copy of the cache. */
    changed: { schema: CHANGED },
  },
})
