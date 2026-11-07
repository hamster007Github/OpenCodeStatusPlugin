# OpenCodeStatusPlugin

OpenCodeStatusPlugin is a distributable OpenCode V2 plugin, published as a GitHub project. It shows
the health of OpenCode Go and the other hosted services inside OpenCode Desktop: a compact status
pill above the composer, a side panel with per-service and per-model detail, and a settings page
that decides what is shown. The data comes from the official status feed, never from scraping the
status page.

## Language

Respond in English unless the user asks for another language. Code, comments, commit messages,
issues, the README and this file are English.

## Working in this project

This repository ships no project-specific agent: these instructions are the whole contract, and any
agent or person working here follows them. For anything about OpenCode itself — plugin package
layout, the GUI SDK, RPC, hooks, the server part — use the global `opencode` skill and the V2 docs it
names; this project does not restate them.

### What this project builds

1. **Server part** (`src/index.ts`) — one poller per OpenCode server: fetch
   `https://status.opencode.ai/api/status`, validate, normalise, cache the last good snapshot with
   its fetch time, and expose it over RPC (`snapshot`, `refresh`). Emit an event after each
   successful poll, so a window can refresh its copy of the cache. Respect `ctx.options` and clean up
   the timer. The cache stays independent of the watched scope, because the settings store can change
   the scope without reloading the server; the shared selector applies it, including for the event.
2. **RPC contract** (`src/rpc.ts`) — the only shape both sides share.
3. **GUI** (`src/gui.tsx`, the `./gui-experimental` entry) — the composer pill, the side panel, the
   settings page and the `provider-status.open` command. The window renders the cache; it never
   fetches the status endpoint itself.
4. **Status domain** (`src/status/`) — types, fetch, normalisation, selectors. The rule that unknown
   is never operational lives here.
5. **Live API contract check** (`scripts/api-contract.ts`, not shipped) — a separate scheduled tool
   that feeds the live payload through the real fetch, parser and scope selector. It reports an
   unreachable endpoint as inconclusive and fails only when the payload breaks the contract.
6. **TUI part** (`src/tui.tsx`, the `./tui` entry) — the CLI footer mark and the `/provider-status`
   service and model list. It is fed by the same server cache over RPC and never fetches the status
   endpoint itself.

### Presentation decisions

Whoever changes what the plugin shows owns these decisions, and can defend them:

- **Which surface carries which fact.** The pill answers "is Go healthy right now?" in one line; the
  panel answers "what exactly is wrong, since when, and which model?". Do not duplicate detail
  between them.
- **Which information is worth showing.** Overall state, per-service state, per-model state, the
  reason (`errors`, `upstream`, `latency`, `availability`), time to first token and tokens per
  second, ongoing incidents with their latest update, the 7-day history, and the age of the last
  check. Cut what does not change a decision.
- **How severity reads at a glance.** One colour scale used consistently; unknown and stale never
  look healthy.
- **When the plugin may interrupt.** Notifications are opt-in, deduplicated across windows, and
  limited to the watched scope. The CLI has its own `tuiNotify` level so the two surfaces can differ.
- **The CLI carries the same two surfaces.** The footer mark is the pill's scope and mark without
  the `OpenCode` prefix, so it fits a terminal; `/provider-status` is the panel. Footer placement is
  per slot (`tuiHomeFooter`, `tuiPromptFooter`, both on by default), and the CLI reads the plugin
  options rather than the desktop settings store.

Before adding a surface or a field, say what it replaces or why the user needs it. A compact pill
that is always right beats a dashboard that is always in the way.

## What is true

### The status API

`https://status.opencode.ai/api/status` is the JSON snapshot behind <https://status.opencode.ai>.
Public, no key, `Cache-Control: public, max-age=15`, and **no CORS header**.

| Field | Meaning |
| --- | --- |
| `status` | Overall state: `operational`, `degraded`, `outage`, `unknown`. |
| `updatedAt`, `since`, `stale` | Snapshot time, first observation, and the origin's own stale flag. |
| `components[]` | One row per service: `service`, `status`, `reason`, `since`, `models[]`, `breakdown[]`, `speed`. |
| `components[].breakdown[]` | Per model: `id`, `status`, `reason`, `speed { ttft, tps }`. |
| `incidents[]` | `id`, `event`, `service`, `startedAt`, `resolvedAt`, `status`, `reason`, `models[]`. |
| `notes[]` | Incident updates: `event`, `body`, `at`, `updatedAt`. |
| `history[]` | 7 days in 3-hour periods: `start`, `services`, `models`. |

Services: `console` (Console API), `logs` (Request logs), `inference` (Inference API), `go` (models
included with Go and Go Plus), `payg` (models billed by usage), `free` (free models and trials).
Reasons: `none`, `errors`, `upstream`, `latency`, `availability`. Speeds are medians over the last
five minutes: `ttft` in milliseconds, `tps` in tokens per second. The feed's `components[].models[]`
is present but empty; the model rows are in `breakdown[]`.

The payload is untrusted input. An unknown state, a missing field or a failed fetch is `unknown`,
never `operational`.

### The desktop plugin

- The GUI is loaded from the plugin's server part; a plugin whose server part fails to load has no
  GUI.
- The desktop app reads plugins only from `opencode.json(c)`, and a plugin's GUI reaches every
  window only when it is configured in the global config. The TUI loads the TUI parts of the plugins
  its server loads; a package with only a TUI part goes in `cli.json`, which this package does not
  need because it has a server part.
- `./gui-experimental` must be one prebuilt CommonJS file, built with the `gui()` preset from
  `@opencode/plugin/gui/vite`.
- The GUI id is the server part's `id`, and it prefixes commands, panel keys and stored keys. Ids in
  the `opencode` namespace and the app's own plugin ids are reserved. The TUI part declares its own
  id (`provider-status-tui`) and namespaces its commands the same way.
- Window `setup` runs per window and is synchronous; `main` runs once per app and may be async.
- The status endpoint has no CORS header, so only the server part (Node) or `main` (Electron) may
  fetch it. A window reads the server's cache over RPC.

## Permissions

Least privilege, and nothing that the global configuration denies is re-enabled.

- Allowed: `read`, `glob`, `grep`, `webfetch`, `websearch`, and `edit` for the project's own files.
- `shell` allows the project loop — `bun install`, `bun run typecheck`, `bun test`, `bun run build`,
  `bun run dev`, `bun outdated` — read-only git inspection including `git remote -v`, and read-only
  server introspection (`opencode api get`, the plugin's own RPC). Installing a toolchain, adding a
  dependency, publishing, restarting the service and loading the plugin still ask.
- Denied: reads of `*.env*`, `~/.ssh`, `~/.aws`, GitHub CLI credentials and the OpenCode
  `auth.json`; the status page's HTML (`https://status.opencode.ai`), while `/api/status` stays
  fetchable.
- The server's own artifacts are readable for debugging: `~/.local/share/opencode/log`,
  `tool-output` and `shell`. They are not editable.
- **Remote git is denied as a policy, not a permission.** No push, no remote change, no `gh` action
  that writes to GitHub (repo, PR, release, workflow, issue, label, secret, variable, ruleset, gist,
  api). A policy denial survives "Allow always" and any later rule.
- `external_directory` asks, so a write outside this folder needs an approval. An approval is
  durable, so the guarantee is a prompt, not a wall; it is never permission to edit outside the
  project. `glob` and `grep` are not gated by that rule, so they stay inside this folder by
  instruction.
- **Changing its own rules is the user's call.** The agent may rewrite `AGENTS.md`,
  `opencode.jsonc`, its own prompt or the source only when the user asks for it, and never to
  loosen a permission or a rule.

## Project rules

- **No scraping.** The status page's HTML is never parsed. The JSON endpoint is the only source; a
  missing field is handled, not worked around by reading the page.
- **No credentials.** The plugin never asks for an API key, a session token or a Console login.
- **One poller per server.** The server part fetches and caches; windows render. No timer in a
  window, no status fetch from a window.
- **Never claim health the data does not support.** Unknown, stale and failed lookups are shown as
  unknown or stale, never as operational.
- **The pill stays compact.** One line, readable without a tooltip. Detail belongs in the panel.
- **The watched scope is configuration, not code.** Services, models and display switches come from
  the plugin options and the settings store. Read `ctx.options` and the settings store where they
  are used; a changed option reloads the plugin.
- **Published behaviour is documented.** A new option or surface updates the README table, the
  settings page and this file in the same change.
- **The GUI API is experimental.** Pin `@opencode/plugin` to the version the plugin was built
  against, say so in the README, keep the plugin usable when a contribution cannot render, and do
  not bundle modules the app provides.

## Data & versioning

- All generated or private output lives in `local/`. Never write it anywhere else.
- `local/` is not versioned. The rest of the folder — instructions, configuration, source and
  package files — is the reusable project shell, which the repository tracks.
- `local/` is the only folder that may hold personal or sensitive data.

## Verification

- `bun run typecheck` and `bun run build` pass, and the build emits one CommonJS file at
  `dist/gui-experimental.cjs`.
- `bun test` passes; the domain tests need no network.
- `bun run check:api` against the live endpoint is green or inconclusive; a contract failure means
  the feed changed, and the parser or the contract needs attention. It is not part of pull request
  CI, so an outage or a network problem never blocks a change.
- CI verifies typecheck, tests and build on Ubuntu, Windows and macOS.
- The plugin loads in **Settings → Extensions → Plugins**, and the pill appears in a session.
- The TUI loads in `opencode`: the footer mark appears, `/provider-status` lists services and models,
  and `tuiHomeFooter`, `tuiPromptFooter` and `tuiNotify` behave as configured.
- A fetch against the live endpoint returns a snapshot whose services and models match the watched
  scope; an unreachable endpoint shows the stale or unknown state instead of an error dialog.
- The README describes what the plugin actually does.
- `python ..\generic\projectbuilder\.claude\skills\change-opencode-project\scripts\check-project.py .`
  — the workspace invariant check.
