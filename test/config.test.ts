import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * The permission list is load-bearing: a typo, a trailing comma or a reordered rule silently
 * changes what this project may do. These tests pin the invariants that the rules document.
 */
interface Rule {
  action: string
  resource: string
  effect: string
}

interface Config {
  plugins?: unknown
  permissions?: Rule[]
  policies?: Rule[]
}

const source = readFileSync(join(import.meta.dir, "..", "opencode.jsonc"), "utf8")

/** Remove `//` comments outside strings, so the file parses with a strict JSON parser. */
function stripComments(input: string): string {
  let out = ""
  let inString = false
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inString) {
      out += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      out += char
      continue
    }

    if (char === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++
      out += "\n"
      continue
    }

    out += char
  }

  return out
}

const config = JSON.parse(stripComments(source)) as Config
const permissions = config.permissions ?? []
const policies = config.policies ?? []

function indexOf(rules: readonly Rule[], action: string, resource: string, effect?: string): number {
  return rules.findIndex(
    (rule) => rule.action === action && rule.resource === resource && (effect === undefined || rule.effect === effect),
  )
}

function requires(...rules: readonly Rule[]): void {
  expect(rules.length).toBeGreaterThan(0)
  for (const rule of rules) {
    expect(rule.action.length).toBeGreaterThan(0)
    expect(rule.resource.length).toBeGreaterThan(0)
    expect(["allow", "deny", "ask"]).toContain(rule.effect)
  }
}

describe("opencode.jsonc", () => {
  test("is strict JSONC with no trailing commas", () => {
    expect(JSON.parse(stripComments(source))).toBeDefined()
    expect(Array.isArray(permissions)).toBe(true)
    expect(Array.isArray(policies)).toBe(true)
  })

  test("every rule is complete", () => {
    requires(...permissions)
    requires(...policies)
  })

  test("does not duplicate the global plugin entry", () => {
    // The global config loads this folder for the desktop app. A second entry in the project config
    // would load a second instance into the same location and collide on ids.
    expect(config.plugins).toBeUndefined()
  })

  test("keeps the build loop and read-only introspection unattended", () => {
    for (const resource of [
      "bun install",
      "bun run typecheck",
      "bun test *",
      "bun run build",
      "bun outdated",
      "git status *",
      "git remote -v",
      "opencode api get *",
    ]) {
      expect(indexOf(permissions, "shell", resource, "allow")).toBeGreaterThan(-1)
    }
  })

  test("denies credentials after the broad read allowance", () => {
    const broad = indexOf(permissions, "read", "*", "allow")
    expect(broad).toBeGreaterThan(-1)

    for (const resource of ["*.env", "*.env.*", "*/.ssh/*", "*/.aws/*", "~/.local/share/opencode/auth.json"]) {
      const deny = indexOf(permissions, "read", resource, "deny")
      expect(deny).toBeGreaterThan(broad)
    }

    // `.env.example` stays readable, and only because its allow comes after the deny.
    expect(indexOf(permissions, "read", "*.env.example", "allow")).toBeGreaterThan(
      indexOf(permissions, "read", "*.env.*", "deny"),
    )
  })

  test("denies the status page but keeps the JSON snapshot", () => {
    const page = indexOf(permissions, "webfetch", "https://status.opencode.ai/*", "deny")
    const snapshot = indexOf(permissions, "webfetch", "https://status.opencode.ai/api/status*", "allow")

    expect(page).toBeGreaterThan(-1)
    expect(snapshot).toBeGreaterThan(page)
  })

  test("keeps the server artifacts read-only", () => {
    expect(indexOf(permissions, "external_directory", "~/.local/share/opencode/log/*", "allow")).toBeGreaterThan(-1)
    expect(indexOf(permissions, "external_directory", "~/.local/share/opencode/tool-output/*", "allow")).toBeGreaterThan(-1)
    expect(indexOf(permissions, "external_directory", "~/.local/share/opencode/shell/*", "allow")).toBeGreaterThan(-1)
    expect(indexOf(permissions, "edit", "~/.local/share/opencode/*", "deny")).toBeGreaterThan(-1)
  })

  test("keeps remote git and GitHub writes impossible", () => {
    for (const resource of [
      "shell:git push *",
      "shell:git * push *",
      "shell:git remote add *",
      "shell:git remote set-url *",
      "shell:gh repo *",
      "shell:gh pr *",
      "shell:gh release *",
      "shell:gh secret *",
    ]) {
      expect(indexOf(policies, "tool.use", resource, "deny")).toBeGreaterThan(-1)
    }

    for (const rule of policies) {
      expect(rule.resource.startsWith("shell:")).toBe(true)
    }
  })
})
