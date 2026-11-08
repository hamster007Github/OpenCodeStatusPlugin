# The status feed

The reference for the feed this plugin renders. Two pieces of code implement it: the parser in
`src/status/parse.ts` and the contract check in `scripts/contract.ts`. A change to the payload shape
is a change to this file and to both of them.

## Endpoint

[`https://status.opencode.ai/api/status`](https://status.opencode.ai/api/status) is the JSON snapshot
behind <https://status.opencode.ai>.

- Public, no key, no credentials.
- `Cache-Control: public, max-age=15`.
- **No CORS header**, so a browser window cannot call it. Only the plugin's server part fetches it;
  windows read the server's cache over RPC.
- The status page's HTML is never parsed. If a field is missing, the parser handles it; it does not
  fall back to reading the page.

## Fields

| Field | Meaning |
| --- | --- |
| `status` | Overall state: `operational`, `degraded`, `outage`, `unknown`. |
| `updatedAt`, `since`, `stale` | Snapshot time, first observation, and the origin's own stale flag. |
| `components[]` | One row per service: `service`, `status`, `reason`, `since`, `models[]`, `breakdown[]`, `speed`. |
| `components[].breakdown[]` | Per model: `id`, `status`, `reason`, `speed { ttft, tps }`. |
| `incidents[]` | `id`, `event`, `service`, `startedAt`, `resolvedAt`, `status`, `reason`, `models[]`. |
| `notes[]` | Incident updates: `event`, `body`, `at`, `updatedAt`. |
| `history[]` | 7 days in 3-hour periods: `start`, `services`, `models`. |

## Enumerations and units

Services: `console` (Console API), `logs` (Request logs), `inference` (Inference API), `go` (models
included with Go and Go Plus), `payg` (models billed by usage), `free` (free models and trials).

Reasons: `none`, `errors`, `upstream`, `latency`, `availability`.

Speeds are medians over the last five minutes: `ttft` in milliseconds, `tps` in tokens per second.

## Reading rules

- **`components[].models[]` is present but empty.** The model rows are in `breakdown[]`. Both are
  read, so a change upstream does not blank the panel.
- **Only ongoing incidents are cached.** `notes[]` carries the updates; the parser keeps the latest
  update per incident event.
- **`history[]` holds 56 buckets** (7 days of 3-hour periods) with a state per service and per model.
- **The payload is untrusted input.** An unknown state, an unknown reason, a missing field or a
  failed fetch is `unknown`, never `operational`. Non-numeric speeds degrade to no value.
- **A failed fetch keeps the last good snapshot** and marks the view stale at `staleAfterSeconds`.
  The origin's own `stale` flag is rendered as-is, and stale never looks healthy.
