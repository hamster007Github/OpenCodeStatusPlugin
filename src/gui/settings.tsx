import { For, Show, createMemo, type JSX } from "solid-js"
import { formatAge } from "../status/format"
import { LIGHT_KEYS, mergeLights } from "../status/lights"
import {
  NOTIFY_LEVELS,
  SERVICE_IDS,
  effectiveScope,
  notifyLevel,
  resolveOptions,
  showHistory,
  showIncidents,
  showSpeed,
} from "../status/options"
import type { LightKey, PrefsValue, ServiceId } from "../status/types"
import { serviceLabel } from "./copy"
import type { StatusController } from "./data"
import type { WindowContext } from "./definition"
import { readPrefs } from "./prefs"

/** One row of the page: a title, an optional description and a control. */
function Row(props: { title: JSX.Element; description?: string; children?: JSX.Element }) {
  return (
    <div class="ocs-setting">
      <div class="ocs-main">
        <div class="ocs-name">{props.title}</div>
        <Show when={props.description}>{(text) => <div class="ocs-detail">{text()}</div>}</Show>
      </div>
      {props.children}
    </div>
  )
}

/**
 * The settings page edits overrides, not a copy of the options: a field the
 * user never touched stays absent, and the option keeps deciding it.
 */
export function StatusSettings(props: { ctx: WindowContext; status: StatusController }) {
  const ctx = props.ctx
  const ui = ctx.ui

  const options = createMemo(() => resolveOptions(ctx.options))
  const prefs = () => readPrefs(ctx)
  const scope = createMemo(() => effectiveScope(options(), prefs()))

  const setPrefs = (patch: PrefsValue) => {
    ctx.stores.prefs.update((draft) => {
      Object.assign(draft as PrefsValue, patch)
    })
  }

  /** Models the current snapshot lists for the watched services. */
  const knownModels = createMemo<string[]>(() => {
    const snapshot = props.status.view()?.snapshot
    if (!snapshot) return []

    const watched = new Set(scope().services)
    const ids = new Set<string>()

    for (const service of snapshot.services) {
      if (!watched.has(service.service)) continue
      for (const model of service.models) ids.add(model.id)
    }

    return [...ids].sort((a, b) => a.localeCompare(b))
  })

  const allModels = () => scope().models === "all"

  const lights = () => mergeLights(options().lights, prefs().lights)

  // The field shows the raw override while editing; an emptied field stays empty here, while the
  // pill falls back through the options and the defaults.
  const lightValue = (key: LightKey) => prefs().lights?.[key] ?? lights()[key]

  const setLight = (key: LightKey, value: string) => {
    ctx.stores.prefs.update((draft) => {
      draft.lights = { ...(draft.lights ?? {}), [key]: value } as typeof draft.lights
    })
  }

  const modelWatched = (id: string): boolean => {
    const selected = scope()
    return selected.models !== "all" && selected.models.includes(id)
  }

  const level = () => notifyLevel(options(), prefs())

  const checked = () => {
    const at = props.status.view()?.checkedAt ?? null
    const since = at === null ? null : formatAge(Math.max(0, Date.now() - at))
    return since ? `${ctx.t("panel.checked")} ${since}` : ctx.t("panel.never")
  }

  const toggleService = (service: ServiceId) => {
    const current = scope().services
    const next = current.includes(service) ? current.filter((id) => id !== service) : [...current, service]

    // At least one service stays watched; otherwise there is nothing to report.
    if (next.length === 0) return

    setPrefs({ services: next })
  }

  const toggleAllModels = (on: boolean) => {
    if (on) {
      setPrefs({ allModels: true })
      return
    }

    setPrefs({ allModels: false, models: knownModels() })
  }

  const toggleModel = (id: string, on: boolean) => {
    const selected = scope()
    const current = selected.models === "all" ? knownModels() : [...selected.models]
    const next = on ? [...new Set([...current, id])] : current.filter((model) => model !== id)

    if (next.length === 0) return

    setPrefs({ allModels: false, models: next })
  }

  return (
    <div class="ocs-settings">
      <header class="ocs-settings-head">
        <h1>{ctx.t("settings.title")}</h1>
        <p class="ocs-detail">{ctx.t("settings.description")}</p>
      </header>

      <section class="ocs-section">
        <h3>{ctx.t("settings.scope")}</h3>
        <For each={SERVICE_IDS}>
          {(service) => (
            <Row title={serviceLabel(ctx, service)}>
              <ui.Switch
                label={serviceLabel(ctx, service)}
                hideLabel
                checked={scope().services.includes(service)}
                onChange={() => toggleService(service)}
              />
            </Row>
          )}
        </For>
        <p class="ocs-muted">{ctx.t("settings.scope.description")}</p>
      </section>

      <section class="ocs-section">
        <h3>{ctx.t("settings.models")}</h3>
        <Row title={ctx.t("settings.models.all")} description={ctx.t("settings.models.all.description")}>
          <ui.Switch label={ctx.t("settings.models.all")} hideLabel checked={allModels()} onChange={toggleAllModels} />
        </Row>

        <Show when={!allModels()}>
          <Show
            when={knownModels().length > 0}
            fallback={<p class="ocs-muted">{ctx.t("settings.models.waiting")}</p>}
          >
            <For each={knownModels()}>
              {(id) => (
                <Row title={<span class="ocs-model">{id}</span>}>
                  <ui.Switch
                    label={id}
                    hideLabel
                    checked={modelWatched(id)}
                    onChange={(on) => toggleModel(id, on)}
                  />
                </Row>
              )}
            </For>
          </Show>
        </Show>
      </section>

      <section class="ocs-section">
        <h3>{ctx.t("settings.display")}</h3>
        <Row title={ctx.t("settings.speed")} description={ctx.t("settings.speed.description")}>
          <ui.Switch
            label={ctx.t("settings.speed")}
            hideLabel
            checked={showSpeed(options(), prefs())}
            onChange={(on) => setPrefs({ showSpeed: on })}
          />
        </Row>
        <Row title={ctx.t("settings.incidents")} description={ctx.t("settings.incidents.description")}>
          <ui.Switch
            label={ctx.t("settings.incidents")}
            hideLabel
            checked={showIncidents(options(), prefs())}
            onChange={(on) => setPrefs({ showIncidents: on })}
          />
        </Row>
        <Row title={ctx.t("settings.history")} description={ctx.t("settings.history.description")}>
          <ui.Switch
            label={ctx.t("settings.history")}
            hideLabel
            checked={showHistory(options(), prefs())}
            onChange={(on) => setPrefs({ showHistory: on })}
          />
        </Row>
      </section>

      <section class="ocs-section">
        <h3>{ctx.t("settings.lights")}</h3>
        <For each={LIGHT_KEYS}>
          {(key) => (
            <Row title={ctx.t(`settings.lights.${key}`)}>
              <ui.TextInput
                label={ctx.t(`settings.lights.${key}`)}
                value={lightValue(key)}
                onInput={(value) => setLight(key, value)}
              />
            </Row>
          )}
        </For>
        <p class="ocs-muted">{ctx.t("settings.lights.description")}</p>
      </section>

      <section class="ocs-section">
        <h3>{ctx.t("settings.alerts")}</h3>
        <Row title={ctx.t("settings.notify")} description={ctx.t("settings.notify.description")}>
          <ui.Menu
            trigger="button"
            label={`${ctx.t("settings.notify")}: ${ctx.t(`settings.notify.${level()}`)}`}
            placement="bottom-end"
            items={NOTIFY_LEVELS.map((value) => ({
              label: ctx.t(`settings.notify.${value}`),
              onSelect: () => setPrefs({ notify: value }),
            }))}
          />
        </Row>
      </section>

      <section class="ocs-section">
        <h3>{ctx.t("settings.data")}</h3>
        <Row title={ctx.t("settings.endpoint")}>
          <span class="ocs-value ocs-model">{options().apiUrl}</span>
        </Row>
        <Row title={ctx.t("settings.interval")}>
          <span class="ocs-value">{formatAge(options().intervalSeconds * 1000)}</span>
        </Row>
        <Row title={ctx.t("settings.checked")}>
          <div class="ocs-row">
            <span class="ocs-muted">{checked()}</span>
            <ui.Button size="small" busy={props.status.busy()} onClick={() => void props.status.refresh()}>
              {ctx.t("settings.refresh")}
            </ui.Button>
          </div>
        </Row>
        <p class="ocs-muted">{ctx.t("settings.note")}</p>
      </section>
    </div>
  )
}
