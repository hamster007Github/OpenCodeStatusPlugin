import { SERVICE_IDS } from "../src/status/options"

/**
 * The raw shape the feed is expected to carry, kept deliberately stricter than
 * the parser. The parser is lenient on purpose — an unknown value degrades to
 * `unknown` — so a monitor built on the parser alone would not notice a renamed
 * field. This module reports that drift instead.
 *
 * A value the feed adds is a warning, never a failure: the plugin already
 * degrades it safely. A value the plugin needs and the feed removed is a
 * failure, because the matching surface would silently go blank.
 */

const FEED_STATES: readonly string[] = ["operational", "degraded", "outage", "unknown"]
const FEED_REASONS: readonly string[] = ["none", "errors", "upstream", "latency", "availability", "unknown"]
const STALE_AFTER_MS = 60 * 60 * 1000
const MAX_BREAKDOWN = 512

export interface ContractInfo {
  services: number
  models: number
  incidents: number
  notes: number
  history: number
  updatedAt: number | null
}

export interface ContractResult {
  errors: string[]
  warnings: string[]
  info: ContractInfo
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isNullableNumber(value: unknown): boolean {
  return value === undefined || value === null || isNumber(value)
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text.length > 0 ? text : null
}

function checkSpeed(errors: string[], label: string, value: unknown): void {
  if (value === undefined || value === null) return
  if (!isRecord(value)) {
    errors.push(`${label}: speed is not an object`)
    return
  }
  if (!isNullableNumber(value.ttft)) errors.push(`${label}: speed.ttft is not a number or null`)
  if (!isNullableNumber(value.tps)) errors.push(`${label}: speed.tps is not a number or null`)
}

export function validateContract(input: unknown): ContractResult {
  const errors: string[] = []
  const warnings: string[] = []
  const info: ContractInfo = { services: 0, models: 0, incidents: 0, notes: 0, history: 0, updatedAt: null }

  if (!isRecord(input)) {
    errors.push("the payload is not a JSON object")
    return { errors, warnings, info }
  }

  const seenServices = new Set<string>()
  const warnedStates = new Set<string>()
  const warnedReasons = new Set<string>()

  if (isNumber(input.updatedAt)) {
    info.updatedAt = input.updatedAt
    const age = Date.now() - input.updatedAt
    if (age > STALE_AFTER_MS) warnings.push(`updatedAt is ${Math.round(age / 60_000)} minutes old`)
  } else {
    errors.push("updatedAt is missing or not a number")
  }

  if (input.status === undefined) warnings.push("overall status is missing")
  else if (typeof input.status !== "string") warnings.push("overall status is not a string")
  else if (!FEED_STATES.includes(input.status)) warnings.push(`overall status has a new value: ${input.status}`)

  if (input.since !== undefined && !isNullableNumber(input.since)) warnings.push("since is not a number or null")
  if (input.stale !== undefined && typeof input.stale !== "boolean") warnings.push("stale is not a boolean")
  if (input.stale === true) warnings.push("the origin reports the snapshot as stale")

  const components = input.components
  if (!Array.isArray(components) || components.length === 0) {
    errors.push("components[] is missing or empty")
  } else {
    let withBreakdown = 0

    for (const entry of components) {
      if (!isRecord(entry)) {
        errors.push("a component is not an object")
        continue
      }

      const service = asText(entry.service)
      if (!service) {
        errors.push("a component has no service")
        continue
      }
      if (seenServices.has(service)) {
        warnings.push(`duplicate component: ${service}`)
        continue
      }
      seenServices.add(service)
      info.services++

      if (typeof entry.status !== "string") errors.push(`${service}: status is missing`)
      else if (!FEED_STATES.includes(entry.status) && !warnedStates.has(entry.status)) {
        warnedStates.add(entry.status)
        warnings.push(`new state value: ${entry.status}`)
      }

      if (entry.reason !== undefined) {
        if (typeof entry.reason !== "string") warnings.push(`${service}: reason is not a string`)
        else if (!FEED_REASONS.includes(entry.reason) && !warnedReasons.has(entry.reason)) {
          warnedReasons.add(entry.reason)
          warnings.push(`new reason value: ${entry.reason}`)
        }
      }

      checkSpeed(errors, `${service}.speed`, entry.speed)

      if (!Array.isArray(entry.breakdown)) {
        errors.push(`${service}: breakdown[] is missing`)
        continue
      }
      if (entry.breakdown.length === 0) {
        if (service === "go") errors.push("go: breakdown[] is empty")
        continue
      }

      withBreakdown++
      for (const model of entry.breakdown.slice(0, MAX_BREAKDOWN)) {
        if (!isRecord(model) || !asText(model.id)) {
          errors.push(`${service}: a breakdown entry has no id`)
          continue
        }
        info.models++

        if (typeof model.status !== "string") errors.push(`${service}/${model.id}: status is missing`)
        else if (!FEED_STATES.includes(model.status) && !warnedStates.has(model.status)) {
          warnedStates.add(model.status)
          warnings.push(`new state value: ${model.status}`)
        }

        if (model.reason !== undefined) {
          if (typeof model.reason !== "string") warnings.push(`${service}/${model.id}: reason is not a string`)
          else if (!FEED_REASONS.includes(model.reason) && !warnedReasons.has(model.reason)) {
            warnedReasons.add(model.reason)
            warnings.push(`new reason value: ${model.reason}`)
          }
        }

        checkSpeed(errors, `${service}/${model.id}.speed`, model.speed)
      }
    }

    if (withBreakdown === 0) errors.push("no component has a non-empty breakdown[]")

    const known = new Set<string>(SERVICE_IDS as readonly string[])
    for (const service of known) {
      if (seenServices.has(service)) continue
      if (service === "go") errors.push("the go service is missing")
      else warnings.push(`known service is missing: ${service}`)
    }
    for (const service of seenServices) {
      if (!known.has(service)) warnings.push(`new service: ${service}`)
    }
  }

  if (Array.isArray(input.incidents)) info.incidents = input.incidents.length
  else if (input.incidents !== undefined) warnings.push("incidents is not an array")

  if (Array.isArray(input.notes)) info.notes = input.notes.length
  else if (input.notes !== undefined) warnings.push("notes is not an array")

  if (!Array.isArray(input.history) || input.history.length === 0) {
    errors.push("history[] is missing or empty")
  } else {
    info.history = input.history.length
    for (const bucket of input.history) {
      if (!isRecord(bucket)) {
        errors.push("a history bucket is not an object")
        break
      }
      if (!isNumber(bucket.start)) {
        errors.push("a history bucket has no numeric start")
        break
      }
      if (!isRecord(bucket.services)) {
        errors.push("a history bucket has no services object")
        break
      }
      if (!isRecord(bucket.models)) {
        errors.push("a history bucket has no models object")
        break
      }
    }
  }

  return { errors, warnings, info }
}

export type Outcome = "pass" | "inconclusive" | "drift"

export interface ReportInput {
  url: string
  checkedAt: string
  attempts: number
  outcome: Outcome
  result?: ContractResult
  note?: string
}

export function formatReport(input: ReportInput): string {
  const lines: string[] = [`# API contract: ${input.outcome}`, ""]

  lines.push(`- Endpoint: ${input.url}`)
  lines.push(`- Checked: ${input.checkedAt}`)
  lines.push(`- Attempts: ${input.attempts}`)

  if (input.result) {
    const { services, models, incidents, history, updatedAt } = input.result.info
    lines.push(`- Services: ${services}, models: ${models}, incidents: ${incidents}, history buckets: ${history}`)
    if (updatedAt !== null) lines.push(`- Feed updatedAt: ${new Date(updatedAt).toISOString()}`)
  }

  if (input.note) lines.push("", input.note)

  lines.push("", "## Errors", "")
  if (!input.result || input.result.errors.length === 0) lines.push("- none")
  else for (const error of input.result.errors) lines.push(`- ${error}`)

  lines.push("", "## Warnings", "")
  if (!input.result || input.result.warnings.length === 0) lines.push("- none")
  else for (const warning of input.result.warnings) lines.push(`- ${warning}`)

  return `${lines.join("\n")}\n`
}
