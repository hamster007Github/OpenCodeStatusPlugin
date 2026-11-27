import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { createRoot, createSignal } from "solid-js"
import * as gui from "@opencode/plugin/gui"
import * as rpc from "@opencode/plugin/rpc"
import * as effect from "effect"

/**
 * Run the real GUI bundle against a fake host, the way the published V2 plugins test theirs.
 * This catches setup-time crashes and proves when the window reads the cache.
 *
 * `dist/` is not versioned, so a clean checkout has no bundle. Build it here, and rebuild it when
 * the source is newer, so the test never passes against a stale bundle after a local edit.
 */
const root = join(import.meta.dir, "..")
const bundle = join(root, "dist", "gui-experimental.cjs")

function newestSource(dir: string): number {
  let newest = 0

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    newest = Math.max(newest, entry.isDirectory() ? newestSource(path) : statSync(path).mtimeMs)
  }

  return newest
}

const stale =
  !existsSync(bundle) ||
  statSync(bundle).mtimeMs < Math.max(newestSource(join(root, "src")), statSync(join(root, "vite.config.ts")).mtimeMs)

if (stale) {
  const build = Bun.spawnSync(["bun", "run", "build"], { cwd: root, stdout: "inherit", stderr: "inherit" })
  if (build.exitCode !== 0) {
    throw new Error("bun run build failed; the GUI bundle test needs dist/gui-experimental.cjs")
  }
}

const source = readFileSync(bundle, "utf8")

const inert: unknown = new Proxy(function () {}, { get: () => inert, apply: () => inert, construct: () => inert as object })
const web = new Proxy({}, { get: () => inert })

const provided: Record<string, unknown> = {
  effect,
  "solid-js": await import("solid-js"),
  "solid-js/web": web,
  "@opencode/plugin/gui": gui,
  "@opencode/plugin/rpc": rpc,
}

const module = { exports: {} as { default?: gui.Plugin.Definition } }
const require = (id: string) => {
  if (id in provided) return provided[id]
  throw new Error(`The app does not provide ${id}`)
}

new Function("module", "exports", "require", source)(module, module.exports, require)
const definition = module.exports.default!

const view = {
  fetchedAt: 1_700_000_000_000,
  checkedAt: 1_700_000_000_000,
  staleAfterSeconds: 180,
  intervalSeconds: 60,
  apiUrl: "https://status.opencode.ai/api/status",
  error: null,
  snapshot: null,
}

function mount() {
  const [session, setSession] = createSignal<unknown>(undefined)
  const calls: Array<{ method: string; options: unknown }> = []
  const remoteCalls: Array<{ method: string; options: unknown }> = []
  const items: Array<{ registry: unknown; item: unknown }> = []

  const client = {
    rpc: () => ({
      snapshot: async (_input: unknown, options: unknown) => {
        calls.push({ method: "snapshot", options })
        return view
      },
      refresh: async (_input: unknown, options: unknown) => {
        calls.push({ method: "refresh", options })
        return view
      },
      events: { on: () => () => undefined },
    }),
  }

  const remoteClient = {
    rpc: () => ({
      snapshot: async (_input: unknown, options: unknown) => {
        remoteCalls.push({ method: "snapshot", options })
        return view
      },
      refresh: async (_input: unknown, options: unknown) => {
        remoteCalls.push({ method: "refresh", options })
        return view
      },
      events: { on: () => () => undefined },
    }),
  }

  const ctx = {
    id: "provider-status",
    options: {},
    signal: new AbortController().signal,
    client,
    sessions: { current: session },
    stores: { prefs: { value: {}, update: (mutate: (draft: object) => void) => mutate({}) } },
    attention: { notify: async () => ({ notification: false, sound: false }) },
    add: (registry: unknown, item: unknown) => items.push({ registry, item }),
    t: (key: string) => key,
    plural: (key: string) => key,
  }

  let cleanup: unknown
  createRoot(() => {
    cleanup = definition.setup!(ctx as never)
  })

  return { calls, remoteCalls, remoteClient, items, setSession, cleanup }
}

describe("the GUI bundle", () => {
  test("registers its contributions without a session", () => {
    const { items } = mount()

    expect(items.map((entry) => entry.registry)).toEqual([
      gui.Command,
      gui.ComposerPill,
      gui.Panel,
      gui.MenuItem,
      gui.SettingsPage,
      gui.Style,
    ])
  })

  test("does not read the cache at setup, before a session is routed", () => {
    // The app's client is not ready before a session mounts; reading there can hang. The session
    // keyed read lives in createKeyed, which is inert outside the app's runtime and cannot be
    // asserted here.
    const { calls } = mount()
    expect(calls).toEqual([])
  })

  test("reads the app's own server for a session on another server, without its location", async () => {
    const { calls, remoteCalls, remoteClient, items, setSession } = mount()
    const panel = items.find((entry) => entry.registry === gui.Panel)?.item as { focus: () => void }

    setSession({
      key: "remote\nsession",
      server: { client: remoteClient },
      location: { directory: "/remote/project" },
    })

    panel.focus()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The status is app-wide: the other server does not need the plugin.
    expect(remoteCalls).toEqual([])
    expect(calls.length).toBeGreaterThan(0)

    // A location the app's server does not know is rejected by the RPC.
    for (const call of calls) {
      expect(call.options).not.toHaveProperty("location")
    }
  })
})
