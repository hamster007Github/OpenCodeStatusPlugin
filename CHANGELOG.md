# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- The README shows screenshots of the pill, the panel, the CLI footer and `/provider-status`; the
  pill and the footer mark which part the plugin adds to the app.
- The README has an **Update** section: `opencode plugin check`, `opencode plugin update`, what an
  exact pinned version skips, and the service restart and Desktop reload when the old version stays
  loaded.

### Changed

- The repository is public, so the **Publish** workflow relies on the provenance that trusted
  publishing generates automatically; the release notes no longer explain a private-repository
  exception.
- Documentation: the feed contract moved to `docs/status-feed.md` and the release steps to
  `docs/releasing.md`. The README is user-facing again, section titles name what they contain, and
  every fact has a single home instead of being repeated across the README, `AGENTS.md` and
  `CONTRIBUTING.md`.

## [0.1.0] - 2026-11-08

### Added

- CI verifies the plugin on Ubuntu, Windows and macOS.
- A daily **API contract** workflow feeds the live status payload through the plugin's own fetch,
  parser and scope selector. It fails only on a schema change and treats an unreachable endpoint or
  a network problem as inconclusive. `bun run check:api` runs the same check locally.
- CLI/TUI: a footer mark with the desktop pill's scope and mark but without the `OpenCode` prefix,
  in both the home and prompt footers (`tuiHomeFooter`, `tuiPromptFooter`, both on by default), and
  `/provider-status`, which lists the watched services and drills into their models. `tuiNotify` adds
  opt-in terminal notifications. Both read the same server cache over RPC; the CLI copy is
  English-only in this version.
