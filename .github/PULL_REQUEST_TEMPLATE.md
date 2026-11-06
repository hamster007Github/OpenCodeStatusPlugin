## What this changes

<!-- One paragraph. Which surface, which fact, and what it replaces. -->

## Checks

- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] `bun run build` emits `dist/gui-experimental.cjs`
- [ ] The plugin still loads in **Settings → Extensions → Plugins**
- [ ] The pill renders in a session, and the panel opens

## Behaviour

- [ ] An unknown state, a missing field or a failed fetch still reads as unknown or stale, never operational
- [ ] No scraping, no credentials, no second data source
- [ ] No new timer in a window; the server part still owns the poller
- [ ] The pill is still one line

## Documentation

- [ ] A new or changed option is in the README option table and on the settings page
- [ ] `AGENTS.md` matches the surfaces and the options
- [ ] `CHANGELOG.md` has an entry under `Unreleased`
