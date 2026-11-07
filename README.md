# OpenCodeStatusPlugin

[![CI](https://github.com/hamster007Github/OpenCodeStatusPlugin/actions/workflows/ci.yml/badge.svg)](https://github.com/hamster007Github/OpenCodeStatusPlugin/actions/workflows/ci.yml)

Provider status for OpenCode Go, inside OpenCode Desktop.

OpenCode Go can degrade or go down in the middle of a session, and nothing in the desktop app tells
you. This plugin polls the official OpenCode status feed and shows the parts you care about — Go and
its models — where you already look: a compact pill above the composer, a side panel with the
detail, and a settings page that decides what is shown.

## What it shows

| Surface | Content |
| --- | --- |
| Composer pill | One line: `OpenCode [scope] mark` — `OpenCode [Go] 🟢` operational, `OpenCode [Go] 🟡` degraded, `OpenCode [Go] 🔴` outage, `OpenCode [Go] ❔️` unknown or stale. Its menu lists the watched services with their state and reason, and opens the panel. |
| Side panel | Per-service and per-model state with the reason (`errors`, `upstream`, `latency`, `availability`), the time since the current state began, median time to first token and tokens per second, ongoing incidents with their latest update, the 7-day history strip, the age of the last check, and a stale warning. |
| Settings page | Which services and models are watched, whether speed, incidents and history are shown, and when the plugin may notify. |
| CLI/TUI | Footer mark `[Go] 🟢` — the desktop pill without the `OpenCode` prefix, because terminal width is limited — in both the home footer and the session prompt footer (each can be turned off) and `/provider-status`, which lists the watched services and drills into their models. Incidents are one more entry. |
| Command | `provider-status.open` opens the panel from the command palette. The side panel's **+** menu lists it too. |

The pill is one line: the product, the watched scope and a mark. It never carries a number, a unit
or a model id: those need room, a baseline and a unit, and they live in the panel.

Deliberately not shown:

- **Models in the pill menu.** A model's state means little without its reason and speed, and the
  panel shows both with units. The menu answers "which service is not healthy" and gets out of the
  way.
- **Per-service history strips.** One strip for the watched scope answers "was it like this
  before?"; six would double the panel and repeat the answer.
- **Resolved incidents.** The 7-day strip covers the past. The status page keeps the full list, and
  the panel links to it.
- **The feed's overall `status`.** It counts services the user does not watch. The pill and the
  panel derive their state from the watched scope only, so a free-tier outage does not alarm a Go
  user.

## Severity

One scale, used by every surface:

| State | Pill mark | Reads as |
| --- | --- | --- |
| `operational` | 🟢 green | nothing to do |
| `degraded` | 🟡 yellow | slower or partly failing |
| `outage` | 🔴 red | not usable |
| `unknown` | `❔️` | the plugin does not know |
| stale | `❔️` | the data is old |

The pill shows the mark only; the words are in its accessible name, its menu rows and the panel, so
colour is reinforcement and never the only signal. `unknown` and stale data never use the green
mark. Each mark is configuration (`lights`), so the pill can show words or another symbol set
instead.

## Data source

[`https://status.opencode.ai/api/status`](https://status.opencode.ai/api/status) is the JSON
snapshot behind <https://status.opencode.ai>. It is public, needs no key and is cached by the origin
for 15 seconds.

- `status`, `updatedAt`, `since`, `stale` — the overall state and the origin's own staleness flag.
- `components[]` — one row per service (`console`, `logs`, `inference`, `go`, `payg`, `free`) with
  its state, reason, `since` and median speed. The model rows are in `breakdown[]`; the
  `models[]` array is present but empty in the feed, so the parser reads both.
- `incidents[]` — incidents with their start, resolution, reason and affected models. Only the
  ongoing ones are cached.
- `notes[]` — incident updates. The parser keeps the latest update per incident event.
- `history[]` — seven days in three-hour periods (56 buckets), with a state per service and per
  model.

The endpoint sends no CORS header, so a browser window cannot call it directly. The plugin's server
part polls and caches it, and the GUI reads that cache over RPC: one request per OpenCode server, not
one per window. The status page's HTML is never parsed.

## Requirements

- OpenCode Desktop 2.x. The GUI plugin API is experimental and may change between releases.
- OpenCode 2.x for the CLI/TUI part. The same global plugin entry loads it; no separate `cli.json`
  entry is needed because the package has a server part.
- This build was made against `@opencode/plugin` **2.2.5**.
- The plugin listed in the **global** `opencode.jsonc`: the desktop app reads plugins only from the
  server it runs, and a plugin's GUI reaches every window only when it is configured globally.
- For development: Bun 1.x.

## Platforms

Windows, macOS and Linux. The plugin has no native code: the server part is one `fetch` plus the
app's APIs, and the GUI is a single JavaScript bundle the app loads.

| Platform | Status |
| --- | --- |
| Windows | developed and verified here: pill, panel, settings page, live feed; CI verifies the build and tests |
| Linux, macOS | CI verifies the build and tests on Ubuntu and macOS; a load in the desktop app is not yet verified |

Notes:

- The global config lives at `~/.config/opencode/opencode.json(c)` (or
  `$XDG_CONFIG_HOME/opencode/opencode.json(c)`) on every platform.
- Linux needs a colour emoji font (Noto Color Emoji is standard on desktop distributions) for the
  default marks. Without one, set `lights` to text, for example
  `{"operational":"OK","degraded":"WARN","outage":"DOWN","unknown":"?","stale":"?"}`.
- Notifications follow the app's notification settings and need a notification daemon on Linux.

## Install

Add it to the **global** config, with the command or by editing the file:

```sh
opencode plugin add opencode-status-plugin
```

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "plugins": ["opencode-status-plugin"],
}
```

The CLI reads the same global entry. No `cli.json` change is needed for this package because it has a
server part; `cli.json` is for packages with only a TUI part.

For local development, point your **global** config at this folder:

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "plugins": [{ "package": "C:/path/to/OpenCodeStatusPlugin", "options": { "services": ["go"] } }],
}
```

List the plugin in one place only. A second entry in the project config loads another instance with
the same id, and the desktop app reports the plugin as failed.

## Configuration

Options are passed in the plugin entry. OpenCode reloads the plugin when they change.

| Option | Default | Meaning |
| --- | --- | --- |
| `services` | `["go"]` | Services to watch: `console`, `logs`, `inference`, `go`, `payg`, `free`. Unknown names are dropped; an empty result falls back to `go`. |
| `models` | `"all"` | `"all"`, or an array of model ids to watch within the selected services. `[]` means `"all"`. |
| `showSpeed` | `true` | Show median time to first token and tokens per second in the panel. |
| `showIncidents` | `true` | Show ongoing incidents and their latest update. |
| `showHistory` | `true` | Show the 7-day history strip in the panel. |
| `intervalSeconds` | `60` | Poll interval, clamped to 30–3600 seconds. The origin caches for 15 seconds, so faster buys nothing. |
| `staleAfterSeconds` | `180` | Age at which a snapshot is stale, clamped to at least the poll interval. |
| `notify` | `"off"` | `"off"`, `"degraded"` or `"outage"`: a system notification when the watched scope reaches that state. |
| `tuiHomeFooter` | `true` | Show the status mark in the CLI home footer. |
| `tuiPromptFooter` | `true` | Show it in the session prompt footer as well. |
| `tuiNotify` | `"off"` | `"off"`, `"degraded"` or `"outage"`: a terminal notification for the watched scope. Separate from `notify`. |
| `apiUrl` | the official endpoint | Override for testing against a mirror. HTTPS only, or plain HTTP on `localhost`/`127.0.0.1`. |
| `lights` | `{"operational":"🟢","degraded":"🟡","outage":"🔴","unknown":"❔️","stale":"❔️"}` | The mark the pill shows for each state. Any text or symbol works; `stale` covers old data. |

```jsonc
{
  "plugins": [
    {
      "package": "opencode-status-plugin",
      "options": {
        "services": ["go", "inference"],
        "models": ["deepseek-v4.1-flash", "glm-5.3-flash"],
        "showSpeed": true,
        "notify": "outage",
        "tuiPromptFooter": true,
        "tuiNotify": "degraded",
        "lights": { "degraded": "WARN", "outage": "DOWN" }
      }
    }
  ],
}
```

**Settings → Extensions → Provider status** edits the same scope, switches and pill marks per app,
and takes precedence over the options. The settings store holds overrides only: a field you never
touched stays absent, so a changed option still applies. At least one service and one model always
stay watched.

Notifications are opt-in. They are limited to the watched scope, and the app deduplicates them by
event id, so several open windows notify once.

The CLI reads the plugin options only. Its footer placement and notification level are not part of
the desktop settings store; set `tuiHomeFooter`, `tuiPromptFooter` and `tuiNotify` in the plugin
entry. The CLI copy is English-only in this version.

The CLI has two footer slots: `home.footer.status` on the start screen, and `prompt.footer.status`
inside a session. If OpenCode restores a session on launch, you are not on the home screen; close
its tab (`Ctrl+X`, then `W`) to get back to home. Both slots show the same `[Go] 🟢` mark once the
first status read has answered.

## How it works

```text
status.opencode.ai/api/status
        │  poll + validate + cache (server part, one per OpenCode server)
        ▼
   RPC `provider-status`: snapshot, refresh, changed
        │
        ├── GUI (window)   ──  composer pill, side panel, settings page, command
        └── TUI (terminal) ──  footer mark, /provider-status service and model list
```

- `src/index.ts` — server part: the poller, the last-good cache, the RPC registration and the
  `changed` event.
- `src/rpc.ts` — the RPC contract (`opencode-status-plugin/rpc`), shared by both sides.
- `src/gui.tsx` — the `./gui-experimental` entry.
- `src/gui/` — window setup, pill, panel, settings page, store and the panel styles.
- `src/tui.tsx` — the `./tui` entry.
- `src/tui/` — CLI controller, footer mark, detail dialogs, notifications and copy.
- `src/copy.ts` — translator-based labels shared by the GUI and the CLI.
- `src/status/` — the status domain: types, fetch, parsing, watched-scope selectors, formatting and
  the shared severity mark.

Facts the code keeps:

- **The server caches a bounded snapshot, the window applies the scope.** The settings page changes
  the watched scope without reloading the server, so the server cannot be the only place that knows
  it. The cache keeps every service in the feed, the ongoing incidents and 56 history buckets; the
  window narrows that to the scope it reads from the store and the options, through the same selector
  on both sides.
- **The payload is untrusted.** Unknown states, unknown reasons, missing fields and non-numeric
  speeds degrade to `unknown` or to no value. A response that does not look like a status document
  keeps the previous cache and marks the view stale.
- **Neither surface has a timer.** The window reads the cache when a session is routed, on every
  `changed` event (one per successful poll, so a window that missed a transition still catches up),
  and when the panel is focused. The CLI reads on setup, on every `changed` event, and when its
  refresh command runs. A refresh asks the server to poll; the poller coalesces a burst of clicks.
- **The origin's model list is `breakdown[]`.** `models[]` exists but is empty; both are read so a
  change upstream does not blank the panel.

## Development

```sh
bun install          # creates bun.lock; commit it
bun run typecheck
bun test
bun run build        # emits dist/gui-experimental.cjs
bun run dev          # vite build --watch: rebuilds and reloads the GUI on every change
```

Load the plugin from this folder in a global config (see Install), then open **Settings →
Extensions → Plugins** and check that it loaded. The server part does not hot-reload; the GUI does.

The bundle is one CommonJS file built with the `gui()` preset. Modules the app provides — `effect`,
`solid-js`, `@opencode/plugin/gui` and the rest — stay external, and the app's own components come
from `ctx.ui`.

The TUI part is loaded from `./src/tui.tsx`; it has no separate bundle. Run `opencode` with the
plugin in the global config to see the footer and `/provider-status`.

### Live API check

`bun run check:api` fetches the live endpoint and passes the response through the same
`fetchStatus` → `parsePayload` → `scopeStatus` path the server uses. It reports contract drift and
exits:

- `0` when the shape holds, or when the endpoint or the network is unreachable (inconclusive),
- `1` only when the endpoint answers with a payload that no longer matches the contract.

A scheduled **API contract** workflow runs it daily and on demand. It is deliberately separate from
pull request CI: a status outage or a GitHub network problem must never block a change.

## Releasing

Publishing is manual. The version lives in `package.json` and is `0.1.0`. Bump it before every later
publish, because npm refuses a duplicate version.

```sh
bun run build          # prepack also builds, so this is a check
bun pm pack --dry-run  # inspect the tarball: src, dist, README, LICENSE, CHANGELOG
npm publish            # first publish: sign in, confirm with your 2FA code
```

The **first** publish of a new package name happens locally, because the trusted publisher is
configured on the package page. After that, publishing goes through GitHub Actions with **npm Trusted
Publishing (OIDC)** — no long-lived token and no 2FA bypass:

1. npmjs.com → your package → **Settings → Trusted Publisher → GitHub Actions**:
   organization `hamster007Github`, repository `OpenCodeStatusPlugin`, workflow filename `publish.yml`.
2. **Actions → Publish → Run workflow**. `dry_run` defaults to `true`, so the first run only builds,
   typechecks, tests, packs, installs the tarball and checks the three exports. Set it to `false` to
   publish.
3. The job refuses a version that is already on npm and publishes with provenance.

The workflow needs an npm CLI that understands OIDC, so it installs the latest npm; GitHub's OIDC
token (`id-token: write`) is exchanged for a short-lived publish credential. If you ever see an
authentication error, the trusted publisher entry is missing or names a different workflow file.

`prepack` builds the GUI bundle, so `dist/` never has to be committed; a publish from a clean clone
still ships the current bundle.

### Test the packed tarball

The tarball can be installed and loaded like the published package, without publishing:

```sh
bun pm pack --destination local
mkdir -p local/pack-test && cd local/pack-test
bun init -y
bun add ../../opencode-status-plugin-0.1.0.tgz

# every export resolves from the installed copy
bun -e "const p = require('opencode-status-plugin'); console.log(p.default.id)"
bun -e "console.log(require.resolve('opencode-status-plugin/gui-experimental'))"
bun -e "console.log(require.resolve('opencode-status-plugin/tui'))"
bun -e "console.log(require('opencode-status-plugin/rpc').ProviderStatus.id)"
```

Then let OpenCode load it from that directory:

```jsonc
// local/pack-test/opencode.jsonc
{ "plugins": ["opencode-status-plugin"] }
```

```sh
opencode api --standalone post /api/rpc/provider-status/snapshot --data "{}"
```

`rpc.invalid_input … Expected object` means the plugin loaded and its RPC is registered — the body is
deliberately incomplete. `rpc.unavailable` means it did not load; check the server log for the plugin
load error. The GUI still needs the global config and a window, so use the panel or the pill there.

The manual **Publish** workflow repeats this: it packs the tarball, installs it into a temp directory
on the runner, and asserts that the server, RPC, TUI and GUI exports resolve before it publishes.

## Open points

- [ ] A load in OpenCode Desktop on Linux or macOS
- [ ] A load of the TUI part in the OpenCode CLI

## Contributing

Issues and pull requests are welcome. Keep the payload handling defensive, keep the pill compact,
and run `bun run typecheck` and `bun test` before opening a pull request. See
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](LICENSE).
