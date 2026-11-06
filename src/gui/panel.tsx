import { For, Show, createMemo } from "solid-js"
import { formatAge, formatStamp, formatTps, formatTtft } from "../status/format"
import {
  STATUS_PAGE_URL,
  effectiveScope,
  resolveOptions,
  showHistory,
  showIncidents,
  showSpeed,
} from "../status/options"
import { isStale, scopeStatus } from "../status/select"
import type { Incident, ModelHealth, ScopedService, Speed } from "../status/types"
import { reasonWord, serviceLabel, stateWord } from "./copy"
import type { StatusController } from "./data"
import type { WindowContext } from "./definition"
import { readPrefs } from "./prefs"

function speedText(speed: Speed | null, enabled: boolean): string | null {
  if (!enabled || !speed) return null

  const ttft = formatTtft(speed.ttft)
  const tps = formatTps(speed.tps)
  const parts: string[] = []

  if (ttft) parts.push(`TTFT ${ttft}`)
  if (tps) parts.push(tps)

  return parts.length > 0 ? parts.join(" · ") : null
}

function age(from: number | null): string | null {
  if (from === null) return null
  return formatAge(Math.max(0, Date.now() - from))
}

function modelDetail(ctx: WindowContext, model: ModelHealth, withSpeed: boolean): string {
  const parts = [stateWord(ctx, model.state)]
  if (model.reason !== "none") parts.push(reasonWord(ctx, model.reason))

  const speed = speedText(model.speed, withSpeed)
  if (speed) parts.push(speed)

  return parts.join(" · ")
}

function incidentDetail(ctx: WindowContext, incident: Incident): string {
  const parts = [stateWord(ctx, incident.state)]
  if (incident.reason !== "none") parts.push(reasonWord(ctx, incident.reason))

  const running = age(incident.startedAt)
  if (running) parts.push(`${ctx.t("panel.for")} ${running}`)

  return parts.join(" · ")
}

function ServiceBlock(props: { ctx: WindowContext; service: ScopedService; withSpeed: boolean }) {
  const ctx = props.ctx

  const detail = () => {
    const parts = [stateWord(ctx, props.service.state)]
    if (props.service.reason !== "none") parts.push(reasonWord(ctx, props.service.reason))

    const since = age(props.service.since)
    if (since) parts.push(`${ctx.t("panel.since")} ${since}`)

    const speed = speedText(props.service.speed, props.withSpeed)
    if (speed) parts.push(speed)

    return parts.join(" · ")
  }

  return (
    <div class="ocs-row">
      <span class="ocs-dot" data-state={props.service.state} />
      <div class="ocs-main">
        <div class="ocs-name">{serviceLabel(ctx, props.service.service)}</div>
        <div class="ocs-detail">{detail()}</div>
        <Show when={props.service.models.length > 0}>
          <div class="ocs-models">
            <For each={props.service.models}>
              {(model) => (
                <div class="ocs-row">
                  <span class="ocs-dot" data-state={model.state} />
                  <span class="ocs-model">{model.id}</span>
                  <span class="ocs-detail">{modelDetail(ctx, model, props.withSpeed)}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

function IncidentCard(props: { ctx: WindowContext; incident: Incident }) {
  const ctx = props.ctx

  return (
    <div class="ocs-card">
      <div class="ocs-row">
        <span class="ocs-dot" data-state={props.incident.state} />
        <span class="ocs-name">{serviceLabel(ctx, props.incident.service)}</span>
      </div>
      <div class="ocs-detail">{incidentDetail(ctx, props.incident)}</div>
      <Show when={props.incident.models.length > 0}>
        <div class="ocs-detail">
          {ctx.t("panel.affected")}: {props.incident.models.join(", ")}
        </div>
      </Show>
      <Show when={props.incident.note}>
        {(note) => (
          <p class="ocs-note">
            {note().body}
            <Show when={formatStamp(note().at)}>{(stamp) => <span class="ocs-muted"> {stamp()}</span>}</Show>
          </p>
        )}
      </Show>
    </div>
  )
}

/**
 * The panel answers what the pill cannot: which service or model, why, since
 * when, and whether it has been like this before. Every number keeps its unit
 * and the age of the last check stays visible, so stale data never reads as
 * fresh.
 */
export function StatusPanel(props: { ctx: WindowContext; status: StatusController }) {
  const ctx = props.ctx
  const ui = ctx.ui

  const options = createMemo(() => resolveOptions(ctx.options))
  const prefs = () => readPrefs(ctx)
  const scope = createMemo(() => effectiveScope(options(), prefs()))
  const view = () => props.status.view()

  const scoped = createMemo(() => {
    const current = view()
    return current?.snapshot ? scopeStatus(current.snapshot, scope()) : undefined
  })

  const stale = createMemo(() => {
    const current = view()
    return current ? isStale(current, Date.now()) : true
  })

  const state = () => scoped()?.state ?? "unknown"

  const checked = () => {
    const current = view()
    const at = current?.checkedAt ?? null
    const since = age(at)
    return since ? `${ctx.t("panel.checked")} ${since}` : ctx.t("panel.never")
  }

  const staleLine = (): string | null => {
    const current = view()
    if (!current) return null
    if (current.snapshot === null) {
      // No error and no snapshot means the first poll is still running; that is not a failure.
      if (!current.error) return null
      return `${ctx.t("panel.unavailable")} (${current.error}). ${ctx.t("panel.failedHint")}`
    }

    const good = age(current.fetchedAt)
    if (!stale()) return null
    if (!good) return ctx.t("panel.stale")

    return `${ctx.t("panel.stale")} ${ctx.t("panel.lastGood")}: ${good}.`
  }

  const emptyText = (): string => {
    const current = view()
    if (!current || current.checkedAt === null) return ctx.t("panel.noData")
    if (current.error) return ctx.t("panel.noSnapshot")
    return ctx.t("panel.checking")
  }

  const checking = (): boolean => {
    const current = view()
    return !current || (current.snapshot === null && !current.error)
  }

  return (
    <div class="ocs-panel">
      <header class="ocs-head">
        <span class="ocs-dot" data-state={state()} />
        <span class="ocs-state">{stateWord(ctx, state())}</span>
        <span class="ocs-age">{checked()}</span>
        <span class="ocs-spacer" />
        <ui.Button variant="ghost" size="small" onClick={() => ctx.system.openExternal(STATUS_PAGE_URL)}>
          {ctx.t("panel.openPage")}
        </ui.Button>
        <ui.Button size="small" busy={props.status.busy()} onClick={() => void props.status.refresh()}>
          {ctx.t("panel.refresh")}
        </ui.Button>
      </header>

      <Show when={staleLine()}>{(line) => <p class="ocs-note">{line()}</p>}</Show>

      <Show
        when={scoped()}
        fallback={
          <>
            <div class="ocs-empty">
              <Show when={checking()}>
                <ui.Loader size="small" />
              </Show>
              <span>{emptyText()}</span>
              <ui.Button size="small" busy={props.status.busy()} onClick={() => void props.status.refresh()}>
                {ctx.t("panel.refresh")}
              </ui.Button>
            </div>
            <p class="ocs-muted">
              {view()?.apiUrl || "no endpoint"} · {"fetched "}
              {age(view()?.fetchedAt ?? null) ?? "never"} · {"checked "}
              {age(view()?.checkedAt ?? null) ?? "never"}
            </p>
          </>
        }
      >
        {(data) => (
          <>
            <section class="ocs-section">
              <h3>{ctx.t("panel.services")}</h3>
              <For each={data().services}>
                {(service) => <ServiceBlock ctx={ctx} service={service} withSpeed={showSpeed(options(), prefs())} />}
              </For>
            </section>

            <Show when={showIncidents(options(), prefs())}>
              <section class="ocs-section">
                <h3>{ctx.t("panel.incidents")}</h3>
                <Show
                  when={data().incidents.length > 0}
                  fallback={<p class="ocs-muted">{ctx.t("panel.noIncidents")}</p>}
                >
                  <For each={data().incidents}>{(incident) => <IncidentCard ctx={ctx} incident={incident} />}</For>
                </Show>
              </section>
            </Show>

            <Show when={showHistory(options(), prefs()) && data().history.length > 0}>
              <section class="ocs-section">
                <h3>{ctx.t("panel.history")}</h3>
                <div class="ocs-strip" data-stale={stale() ? "true" : "false"}>
                  <For each={data().history}>
                    {(cell) => <span class="ocs-cell" data-state={cell.state} title={formatStamp(cell.start) ?? ""} />}
                  </For>
                </div>
              </section>
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}
