# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- CI verifies the plugin on Ubuntu, Windows and macOS.
- A daily **API contract** workflow feeds the live status payload through the plugin's own fetch,
  parser and scope selector. It fails only on a schema change and treats an unreachable endpoint or
  a network problem as inconclusive. `bun run check:api` runs the same check locally.
