import { Plugin } from "@opencode/plugin/gui"
import { definition } from "./gui/definition"
import { setup } from "./gui/window"

/**
 * The `./gui-experimental` entry. It declares the settings store and the copy,
 * and contributes the composer pill, the side panel, the settings page and the
 * command from the window setup.
 */
export default Plugin.define({
  ...definition,
  setup,
})
