import { describe, expect, test } from "bun:test"
import type { Plugin } from "@opencode/plugin/tui"
import { resolveOptions } from "../src/status/options"
import type { ScopedStatus, StatusSnapshot, StatusView } from "../src/status/types"
import definition from "../src/tui"
import { createStatus } from "../src/tui/data"
import { footerLabel } from "../src/tui/mark"

const now = Date.now()

const snapshot: StatusSnapshot = {
  updatedAt: now,
  since: null,
  stale: false,
  state: "operational",
  services: [
    { service: "go", state: "operational", reason: "none", since: null, speed: null, models: [] },
  ],
  incidents: [],
  history: [],
}

const view: StatusView = {
  fetchedAt: now,
  checkedAt: now,
  staleAfterSeconds: 180,
  intervalSeconds: 60,
  apiUrl: "https://status.opencode.ai/api/status",
  snapshot,
  error: null,
}

const scoped: ScopedStatus = {
  state: "operational",
  services: [
    { service: "go", state: "operational", reason: "none", since: null, speed: null, models: [] },
  ],
  models: [],
  incidents: [],
  history: [],
}

describe("the TUI footer", () => {
  test("shows the same label as the desktop pill", () => {
    const options = resolveOptions({})

    expect(footerLabel(view, scoped, false, options)).toBe("[Go] 🟢")
    expect(footerLabel(view, scoped, true, options)).toBe("[Go] ❔️")
  })

  test("stays away before the first answer", () => {
    const options = resolveOptions({})

    expect(footerLabel(undefined, undefined, true, options)).toBeUndefined()
    expect(footerLabel({ ...view, snapshot: null, error: null }, undefined, true, options)).toBeUndefined()
    expect(footerLabel({ ...view, snapshot: null, error: "timed out" }, undefined, true, options)).toBe(
      "[Go] ❔️",
    )
  })
})

function fakeContext(
  onCall: (method: string, options: unknown) => void,
  notification: () => void,
  state: StatusSnapshot = snapshot,
  options: Record<string, unknown> = {},
): { context: Plugin.Context; triggerChanged: () => void; unsubscribed: () => boolean } {
  let changed: (() => void) | undefined
  let off = false

  const value: StatusView = {
    ...view,
    snapshot: state,
    fetchedAt: Date.now(),
    checkedAt: Date.now(),
  }

  const client = {
    rpc: () => ({
      snapshot: async (_input: unknown, options: unknown) => {
        onCall("snapshot", options)
        return value
      },
      refresh: async (_input: unknown, options: unknown) => {
        onCall("refresh", options)
        return value
      },
      events: {
        on: (_name: string, handler: () => void) => {
          changed = handler
          return () => {
            off = true
          }
        },
      },
    }),
  }

  const context = {
    options,
    location: { directory: "/tmp/project" },
    client,
    data: { location: { default: () => ({ directory: "/tmp/project" }) } },
    attention: {
      notify: async () => {
        notification()
        return { ok: true, notification: true, sound: false }
      },
    },
  } as unknown as Plugin.Context

  return {
    context,
    triggerChanged: () => changed?.(),
    unsubscribed: () => off,
  }
}

describe("the TUI status controller", () => {
  test("reads the cache with the location, subscribes and refreshes", async () => {
    const calls: Array<{ method: string; options: unknown }> = []
    let notifications = 0
    const fake = fakeContext((method, options) => calls.push({ method, options }), () => notifications++)

    const controller = createStatus(fake.context)
    await controller.reload()

    expect(calls[0]).toEqual({ method: "snapshot", options: { location: { directory: "/tmp/project" } } })
    expect(controller.view()?.snapshot).not.toBeNull()
    expect(controller.scoped()?.state).toBe("operational")
    expect(notifications).toBe(0)

    fake.triggerChanged()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls.filter((call) => call.method === "snapshot").length).toBeGreaterThanOrEqual(2)

    await controller.refresh()
    expect(calls.some((call) => call.method === "refresh")).toBe(true)

    controller.dispose()
    expect(fake.unsubscribed()).toBe(true)
  })

  test("notifies on an outage when configured", async () => {
    const outage: StatusSnapshot = {
      ...snapshot,
      state: "outage",
      services: [
        { service: "go", state: "outage", reason: "errors", since: 987_654_321, speed: null, models: [] },
      ],
    }

    let notifications = 0
    const fake = fakeContext(() => undefined, () => notifications++, outage, { tuiNotify: "outage" })

    const controller = createStatus(fake.context)
    await controller.reload()

    expect(notifications).toBe(1)
    controller.dispose()
  })

  test("registers the footer and commands", async () => {
    const slots: string[] = []
    const commands: Array<{ id?: string }> = []
    const fake = fakeContext(() => undefined, () => undefined)

    const context = {
      ...fake.context,
      ui: {
        slot: (claim: Record<string, unknown>) => {
          slots.push(String(claim.append ?? claim.prepend ?? claim.before ?? claim.after ?? claim.replace ?? ""))
          return () => undefined
        },
      },
      keymap: {
        layer: (factory: () => { commands?: Array<{ id?: string }> }) => {
          commands.push(...(factory().commands ?? []))
        },
      },
    } as unknown as Plugin.Context

    const cleanup = await definition.setup(context)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(definition.id).toBe("provider-status-tui")
    expect(slots).toEqual(["home.footer.status", "prompt.footer.status"])
    expect(commands.map((command) => command.id)).toEqual(["provider-status.open", "provider-status.refresh"])

    cleanup?.()
  })
})
