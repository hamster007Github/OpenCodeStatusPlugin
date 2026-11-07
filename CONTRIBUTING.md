# Contributing

Thanks for helping. This plugin shows OpenCode Go health inside OpenCode Desktop, and it stays small
on purpose: one pill, one panel, one settings page.

## Requirements

- [Bun](https://bun.sh) 1.x for install, test and build. Node.js is not needed.
- OpenCode Desktop 2.x to load the plugin.

`@opencode/plugin` is pinned to the version the plugin was built against. Bumping it is a change of
its own, with a note in the README.

## Set up

```sh
bun install          # creates bun.lock; commit it
bun run typecheck
bun test
bun run build        # emits dist/gui-experimental.cjs
```

For the GUI loop:

```sh
bun run dev          # vite build --watch: every rebuild reloads the plugin's GUI
```

The server part does not hot-reload. Change its source and reload OpenCode, or remove and re-add the
plugin.

## Load it locally

Add the folder to the **global** `opencode.json(c)`, so every window gets the GUI:

```jsonc
{
  "plugins": [{ "package": "C:/path/to/OpenCodeStatusPlugin", "options": { "services": ["go"] } }],
}
```

Then open **Settings → Extensions → Plugins** and check that the plugin loaded. A plugin whose
server part fails to load has no GUI, so an empty row there usually means the server part threw
during setup.

List the plugin in one place only: the **global** config. A second entry in the project config loads
another instance with the same id, and the desktop app reports the plugin as failed.

## Layout

```text
src/index.ts        server part: one poller, cache, RPC
src/rpc.ts          the contract between server and windows
src/gui.tsx         ./gui-experimental entry
src/gui/            window setup, pill, panel, settings, store, copy
src/status/         types, fetch, normalisation, selectors, formatting
test/               tests for the status domain
```

## Rules that are not negotiable

- The upstream payload is untrusted. An unknown state, a missing field or a failed fetch becomes
  `unknown` or `stale`. Never render it as `operational`.
- No scraping, no credentials, no second data source. `https://status.opencode.ai/api/status` is the
  only source, and only the server part may fetch it.
- One poller per OpenCode server. Windows read the cache over RPC and set no status timer.
- The pill stays one line. Detail belongs in the panel.
- The watched scope is configuration: options and the settings store. Never hard-code a service or a
  model list in a surface.

## A change that adds an option or a surface

Update, in the same pull request:

1. `README.md`: the option table and the surface table,
2. the settings page in `src/gui/settings.tsx`,
3. `AGENTS.md`,
4. `CHANGELOG.md` under `Unreleased`.

## Tests

`test/` covers the status domain: parsing the payload and the normalised snapshot, the severity
scale and pill marks (`lights`), the watched scope, stale detection, option validation and the live
API contract validator. It also pins the project's own invariants: the permission rules in the
configuration and the plugin's surface. Those tests need no network.

The live endpoint belongs to the separate **API contract** workflow. It runs daily and on demand,
and treats an unreachable endpoint as inconclusive; only a payload that no longer matches the
contract fails. `bun run check:api` runs the same check locally.

## Commits and pull requests

- One subject per commit, imperative mood, no prefix conventions to learn.
- Keep the pull request description short: what changes, which surface, what it replaces.
- Run the checklist in the pull request template before asking for a review.

## Licence

Contributions are MIT-licensed, like the project.
