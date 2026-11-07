import { appendFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_API_URL } from "../src/status/options"
import { fetchStatus } from "../src/status/fetch"
import { parsePayload } from "../src/status/parse"
import { scopeStatus } from "../src/status/select"
import { formatReport, type ContractResult, type Outcome, validateContract } from "./contract"

/**
 * The scheduled live check. It feeds the real fetch, parser and scope selector
 * with the current status payload, so a feed change is seen by the same code
 * that will ship it.
 *
 * Exit codes:
 *   0 — the contract holds, or the answer was inconclusive (endpoint or network down)
 *   1 — the endpoint answered with a payload that breaks the contract
 */

const ATTEMPTS = 3
const TIMEOUT_MS = 10_000
const BACKOFF_MS = [0, 2_000, 5_000]

type Fetched =
  | { ok: true; payload: unknown; attempts: number }
  | { ok: false; error: string; attempts: number }

async function fetchWithRetry(url: string): Promise<Fetched> {
  let error = "request failed"

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1] ?? 5_000))

    const result = await fetchStatus({ url, timeoutMs: TIMEOUT_MS })
    if (result.ok) return { ok: true, payload: result.payload, attempts: attempt }
    error = result.error
  }

  return { ok: false, error, attempts: ATTEMPTS }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function report(
  url: string,
  checkedAt: string,
  attempts: number,
  outcome: Outcome,
  result?: ContractResult,
  note?: string,
): string {
  const markdown = formatReport({ url, checkedAt, attempts, outcome, result, note })
  console.log(markdown)

  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) appendFileSync(summary, `${markdown}\n`)

  return markdown
}

function saveArtifacts(markdown: string, payload: unknown): void {
  const dir = process.env.RUNNER_TEMP ?? tmpdir()
  writeFileSync(join(dir, "api-contract-report.md"), markdown)
  writeFileSync(join(dir, "api-contract-payload.json"), JSON.stringify(payload, null, 2))
}

function inconclusive(url: string, checkedAt: string, attempts: number, note: string): void {
  report(url, checkedAt, attempts, "inconclusive", undefined, note)
  console.log(`::warning::API contract check inconclusive: ${note}`)
}

async function main(): Promise<void> {
  const checkedAt = new Date().toISOString()
  const fetched = await fetchWithRetry(DEFAULT_API_URL)

  if (!fetched.ok) {
    inconclusive(
      DEFAULT_API_URL,
      checkedAt,
      fetched.attempts,
      `No usable answer after ${fetched.attempts} attempts (${fetched.error}). The endpoint or the network is down; this is not a contract failure.`,
    )
    return
  }

  if (!isRecord(fetched.payload)) {
    inconclusive(
      DEFAULT_API_URL,
      checkedAt,
      fetched.attempts,
      "The endpoint answered with JSON that is not an object. Treating it as inconclusive.",
    )
    return
  }

  const result = validateContract(fetched.payload)
  const snapshot = parsePayload(fetched.payload)

  if (!snapshot) {
    result.errors.push("parsePayload() returned null for the live payload")
  } else {
    const scoped = scopeStatus(snapshot, { services: ["go"], models: "all" })
    const go = scoped.services.find((service) => service.service === "go")

    if (!go) result.errors.push("the default scope (go) has no service after parsing")
    else if (go.models.length === 0) result.errors.push("the default scope (go) has no models after parsing")
  }

  const outcome: Outcome = result.errors.length === 0 ? "pass" : "drift"
  const markdown = report(DEFAULT_API_URL, checkedAt, fetched.attempts, outcome, result)

  if (outcome === "drift") {
    saveArtifacts(markdown, fetched.payload)
    console.log(`::error::API contract drift: ${result.errors.join("; ")}`)
    process.exitCode = 1
  }
}

if (import.meta.main) await main()
