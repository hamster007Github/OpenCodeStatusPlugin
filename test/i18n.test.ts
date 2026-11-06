import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { de, en } from "../src/gui/i18n"

const gui = join(import.meta.dir, "..", "src", "gui")

function walk(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

/**
 * `ctx.t` returns an empty string for a key the dictionary does not have, so a
 * missing key shows as a blank label instead of an obvious error. Every key a
 * surface uses literally must exist in both languages.
 */
describe("the copy dictionary", () => {
  test("has every key the GUI uses literally", () => {
    const used = new Set<string>()

    for (const file of walk(gui)) {
      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(/ctx\.t\("([^"]+)"\)/g)) used.add(match[1]!)
    }

    const missing = [...used].filter((key) => !(key in en) || !(key in de))
    expect(missing).toEqual([])
  })

  test("defines the same keys in both languages", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort())
  })
})
