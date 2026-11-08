# Contributing

Thanks for helping. This plugin shows OpenCode Go health inside OpenCode Desktop, and it stays small
on purpose: one pill, one panel, one settings page.

## Requirements

- [Bun](https://bun.sh) 1.x for install, test and build. Node.js is needed only for the npm commands in
  [docs/releasing.md](docs/releasing.md).
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
src/gui/            window setup, pill, panel, settings, store
src/tui.tsx         ./tui entry
src/tui/            CLI controller, footer mark, detail, notifications, copy
src/copy.ts         labels shared by the GUI and the CLI
src/status/         types, fetch, normalisation, selectors, formatting, marks
test/               tests for the status domain and the TUI controller
```

## Invariants

The contract is [`AGENTS.md`](AGENTS.md); these are the ones a pull request is judged by:

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
4. the relevant file under `docs/`,
5. `CHANGELOG.md` under `Unreleased`.

## Tests

`test/` covers the status domain: parsing the payload and the normalised snapshot, the severity
scale and pill marks (`lights`), the watched scope, stale detection, option validation, the live
API contract validator and the TUI controller. It also pins the project's own invariants: the
permission rules in the configuration and the plugin's surface. Those tests need no network.

The live endpoint belongs to the separate **API contract** workflow. It runs daily and on demand,
and treats an unreachable endpoint as inconclusive; only a payload that no longer matches the
contract fails. `bun run check:api` runs the same check locally.

## Commits and pull requests

- Conventional Commits: `feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `test:`, `refactor:`. Imperative
  subject, 72 characters, the reason in the body. Note a breaking change with `BREAKING CHANGE:`.
- One change per commit. A formatting sweep, a dependency bump and a feature do not share a commit.
- Work on a branch and open a pull request; `main` is squash-merged and linear.
- `main` is public history: no amend, rebase or force-push, and a published tag is never moved.
  Revert instead.
- Every user-visible change carries its `## Unreleased` CHANGELOG entry in the same pull request.
- Keep the pull request description short: what changes, which surface, what it replaces.
- Run the checklist in the pull request template before asking for a review.

## License

Contributions are MIT-licensed, like the project.
