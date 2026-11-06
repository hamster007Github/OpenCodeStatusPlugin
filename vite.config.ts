import { defineConfig } from "vite"
import { gui } from "@opencode/plugin/gui/vite"

// The GUI preset emits the single CommonJS bundle that `./gui-experimental` points at.
export default defineConfig({
  plugins: [gui()],
})
