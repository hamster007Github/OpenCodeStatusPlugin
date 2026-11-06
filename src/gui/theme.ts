import type { Lights, State } from "../status/types"
import { DEFAULT_LIGHTS } from "../status/lights"

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
 * The pill's own colour is gone: the capsule carries a round light in its label, so the tone is
 * unused there. The panel and the menu rows still use the shared scale.
 */

/**
 * The pill's mark for a state. `lights` is configuration: the defaults are the round lights, and a
 * user may replace any of them with text or another symbol. Stale outranks the state: old data is
 * not a colour, it is a question.
 */
export function pillLight(state: State, stale: boolean, lights: Lights = DEFAULT_LIGHTS): string {
  return stale ? lights.stale : lights[state]
}

/**
 * The panel is rendered with the app's own primitives, so the only styling this
 * plugin owns is the state dot, the history strip and the warning line.
 */
export const styles = `
.ocs-panel {
  --ocs-ok: #40c057;
  --ocs-warn: #fab005;
  --ocs-bad: #e03131;
  --ocs-unknown: #adb5bd;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.45;
  min-width: 0;
}
.ocs-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ocs-state { font-weight: 600; }
.ocs-age { opacity: 0.65; white-space: nowrap; }
.ocs-spacer { flex: 1; }
.ocs-section { display: flex; flex-direction: column; gap: 6px; }
.ocs-section > h3 {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.6;
}
.ocs-row { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.ocs-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.ocs-name { font-weight: 500; }
.ocs-model { font-family: var(--ocs-mono, ui-monospace, SFMono-Regular, Menlo, monospace); }
.ocs-detail { opacity: 0.7; }
.ocs-muted { opacity: 0.6; }
.ocs-models { display: flex; flex-direction: column; gap: 3px; padding-left: 16px; }
.ocs-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  border-radius: 6px;
}
.ocs-note {
  margin: 0;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(250, 176, 5, 0.14);
}
.ocs-empty { display: flex; align-items: center; gap: 8px; opacity: 0.7; }
.ocs-dot {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ocs-unknown);
  border: 1px dashed var(--ocs-unknown);
  background-clip: padding-box;
}
.ocs-dot[data-state="operational"] { background: var(--ocs-ok); border-color: var(--ocs-ok); }
.ocs-dot[data-state="degraded"] { background: var(--ocs-warn); border-color: var(--ocs-warn); }
.ocs-dot[data-state="outage"] { background: var(--ocs-bad); border-color: var(--ocs-bad); }
.ocs-dot[data-state="unknown"] { background: transparent; border-style: dashed; }
.ocs-strip { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 1px; height: 14px; }
.ocs-strip[data-stale="true"] { opacity: 0.5; }
.ocs-cell { border-radius: 2px; background: var(--ocs-unknown); }
.ocs-cell[data-state="operational"] { background: var(--ocs-ok); }
.ocs-cell[data-state="degraded"] { background: var(--ocs-warn); }
.ocs-cell[data-state="outage"] { background: var(--ocs-bad); }
.ocs-cell[data-state="unknown"] { background: transparent; border: 1px dashed var(--ocs-unknown); }
.ocs-settings { display: flex; flex-direction: column; gap: 18px; max-width: 720px; padding: 4px 0; font-size: 13px; }
.ocs-settings-head h1 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
.ocs-settings-head p { margin: 0; }
.ocs-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(127, 127, 127, 0.18);
}
.ocs-settings .ocs-section .ocs-setting:last-of-type { border-bottom: 0; }
.ocs-value { max-width: 55%; text-align: right; word-break: break-all; opacity: 0.7; }
`.trim()
