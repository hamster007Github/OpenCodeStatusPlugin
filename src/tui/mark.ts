import { scopeLabel } from "../copy"
import { statusMark } from "../status/marks"
import type { ResolvedOptions, ScopedStatus, StatusView } from "../status/types"
import { t } from "./copy"

/**
 * The footer is the TUI's pill. The terminal is narrower than the desktop, so it
 * keeps the scope and the mark but drops the product prefix: `[Go] 🟢`. The
 * mark comes from the shared `lights` option.
 */
export function footerLabel(
  view: StatusView | undefined,
  scoped: ScopedStatus | undefined,
  stale: boolean,
  options: ResolvedOptions,
): string | undefined {
  if (!view) return undefined
  // The first poll is still running: an unknown mark for a second is noise.
  if (view.snapshot === null && view.error === null) return undefined

  const state = scoped?.state ?? "unknown"
  const mark = statusMark(state, stale, options.lights)

  return `[${scopeLabel(t, options.services)}] ${mark}`
}
