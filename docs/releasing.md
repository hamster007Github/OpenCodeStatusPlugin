# Releasing

The runbook for a version bump and a publish to npm. It applies to the maintainer account; nothing
here runs in CI except the manual **Publish** workflow.

## 1. Prepare the version

1. Bump `version` in `package.json`. A published version number cannot be reused, so a bad publish is
   corrected with a patch bump, not by deleting it.
2. In `CHANGELOG.md`, rename `## Unreleased` to `## [x.y.z] - YYYY-MM-DD` and open a fresh
   `## Unreleased` block above it.
3. Commit as `chore(release): x.y.z` and merge to `main`.

While at `0.x`, a minor bump may break; say so under `### Changed`.

## 2. Gate

```sh
bun run typecheck
bun test
bun run build
bun run check:api          # green or inconclusive; only a payload break fails
bun pm pack --dry-run      # the file list: src, dist, README, LICENSE, CHANGELOG
```

## 3. Publish

npm refuses a duplicate version, and a 2FA code is required for a direct `npm publish`. Two paths:

### Staged publish (works with a security key as the second factor)

```sh
npm login --auth-type=web      # once per machine: browser approval, no terminal OTP
npm whoami                     # the account that will publish
npm stage publish              # uploads to the staging area; needs no 2FA
npm stage list                 # stage id, status and shasum
npm stage download <stage-id>  # optional: the exact tarball that will go live
```

Then approve in the browser: npmjs.com → **Staged Packages** → the entry → **Approve** (the 2FA
prompt happens there). The status goes from `validating` to approvable; approval publishes the
version.

Notes:

- Staging a name that does not exist yet publishes a public placeholder `0.0.0-stage`, which claims
  the name. The staged version itself stays private until it is approved.
- Staged publishing needs npm ≥ 11.15 and Node ≥ 22.14 (`npm install -g npm@latest`).
- `npm stage publish` runs `prepack`, so `bun` must be on `PATH` in that shell.

### GitHub Actions with Trusted Publishing (OIDC)

After the first publish, npmjs.com → `opencode-status-plugin` → **Settings → Trusted publishing** →
GitHub Actions:

- organization `hamster007Github`, repository `OpenCodeStatusPlugin`, workflow `publish.yml`
- tick **Allow npm publish** (new entries default to stage-only, and the workflow publishes directly)
- a new entry expires if it has not completed a successful publish within two days

Then **Actions → Publish → Run workflow**. `dry_run` defaults to `true`, so the first run only builds,
typechecks, tests, packs, installs the tarball and checks the exports. Run it again with `false` to
publish. The job refuses a version that is already on npm.

There is no long-lived token: GitHub's OIDC token (`id-token: write`) is exchanged for a short-lived
publish credential. If authentication fails, the trusted publisher entry is missing or names a
different workflow file.

**Provenance** is generated automatically by trusted publishing, but only for a build from a **public**
repository. The workflow therefore passes no `--provenance` flag; on a private repository no
attestation is produced and the publish still succeeds. Making the repository public gives the next
release an attestation without any workflow change.

`prepack` builds the GUI bundle, so `dist/` is never committed; a publish from a clean clone still
ships the current bundle.

## 4. After the publish

```sh
npm view opencode-status-plugin version
npm view opencode-status-plugin dist-tags

git tag -a vx.y.z -m "x.y.z"
git push origin main --follow-tags
```

Then create a GitHub release from the tag with the CHANGELOG section as its notes. From a public
repository that release is the user-facing record of the version.

Users do not receive the version automatically. An unpinned entry picks it up with
`opencode plugin update`; an entry pinned to an exact version stays where it is until its owner changes
it. Write the release notes for that decision, because the update is a deliberate action.

Finally, prove that OpenCode loads the published package — the registry serving it is not the same
thing:

1. Add `"opencode-status-plugin"` to the **global** `opencode.jsonc`.
2. Restart OpenCode and check the pill in a session, `/provider-status` in the CLI, and the footer
   mark.
3. `opencode api --standalone post /api/rpc/provider-status/snapshot --data "{}"`:
   `rpc.invalid_input … Expected object` means the plugin loaded and registered its RPC; the body is
   deliberately incomplete. `rpc.unavailable` means it did not load — check the server log.

## Appendix: install the tarball without publishing

Useful to test a release candidate end to end:

```sh
bun pm pack --destination local
mkdir -p local/pack-test && cd local/pack-test
bun init -y
bun add ../../opencode-status-plugin-x.y.z.tgz

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

The manual **Publish** workflow repeats this check: it packs the tarball, installs it into a temp
directory on the runner, and asserts that the server, RPC, TUI and GUI exports resolve before it
publishes.
