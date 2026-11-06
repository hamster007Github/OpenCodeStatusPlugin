import type { PrefsValue } from "../status/types"
import type { WindowContext } from "./definition"

/** The settings store, read as plain overrides. */
export function readPrefs(ctx: WindowContext): PrefsValue {
  return (ctx.stores.prefs.value ?? {}) as unknown as PrefsValue
}
