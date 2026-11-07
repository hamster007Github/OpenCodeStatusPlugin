/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { Show } from "solid-js"
import { reasonWord, serviceLabel, stateWord } from "./copy"
import { formatAge, formatTps, formatTtft } from "./status/format"
import type { Incident, ModelHealth, ResolvedOptions, ScopedService, Speed } from "./status/types"
import { t } from "./tui/copy"
import { createStatus, type TuiStatusController } from "./tui/data"
import { footerLabel } from "./tui/mark"

function Footer(props: { label: () => string | undefined }) {
  return <Show when={props.label()}>{(label) => <text>{label()}</text>}</Show>
}

function speedLine(speed: Speed | null, options: ResolvedOptions): string | null {
  if (!options.showSpeed || !speed) return null

  const parts: string[] = []
  const ttft = formatTtft(speed.ttft)
  const tps = formatTps(speed.tps)

  if (ttft) parts.push(`TTFT ${ttft}`)
  if (tps) parts.push(tps)

  return parts.length > 0 ? parts.join(" · ") : null
}

function serviceLine(service: ScopedService, options: ResolvedOptions): string {
  const parts = [stateWord(t, service.state)]
  if (service.reason !== "none") parts.push(reasonWord(t, service.reason))

  if (service.since !== null) {
    parts.push(`${t("panel.since")} ${formatAge(Math.max(0, Date.now() - service.since))}`)
  }

  const speed = speedLine(service.speed, options)
  if (speed) parts.push(speed)

  return parts.join(" · ")
}

function modelLine(model: ModelHealth, options: ResolvedOptions): string {
  const parts = [stateWord(t, model.state)]
  if (model.reason !== "none") parts.push(reasonWord(t, model.reason))

  const speed = speedLine(model.speed, options)
  if (speed) parts.push(speed)

  return parts.join(" · ")
}

function incidentMessage(incidents: readonly Incident[]): string {
  return incidents
    .map((incident) => {
      const parts = [`${serviceLabel(t, incident.service)} — ${stateWord(t, incident.state)}`]
      if (incident.reason !== "none") parts.push(reasonWord(t, incident.reason))

      if (incident.startedAt !== null) {
        parts.push(`${t("panel.for")} ${formatAge(Math.max(0, Date.now() - incident.startedAt))}`)
      }

      if (incident.note) parts.push(incident.note.body)
      return parts.join(" · ")
    })
    .join("\n")
}

async function openDetail(context: Plugin.Context, controller: TuiStatusController): Promise<void> {
  const view = controller.view()

  if (!view) {
    await context.ui.dialog.alert({ title: t("panel.title"), message: t("panel.noData") })
    return
  }

  if (view.snapshot === null) {
    await context.ui.dialog.alert({
      title: t("panel.unavailable"),
      message: view.error ?? t("panel.noData"),
    })
    return
  }

  const scoped = controller.scoped()
  if (!scoped) {
    await context.ui.dialog.alert({ title: t("panel.title"), message: t("panel.noSnapshot") })
    return
  }

  const checked =
    view.checkedAt !== null
      ? `${t("panel.checked")} ${formatAge(Math.max(0, Date.now() - view.checkedAt))}`
      : t("panel.never")
  const title = `${t("panel.title")} · ${checked}${controller.stale() ? ` · ${t("state.stale")}` : ""}`

  const services: Array<{ title: string; description: string; value: string }> = scoped.services.map((service) => ({
    title: `${serviceLabel(t, service.service)} — ${stateWord(t, service.state)}`,
    description: serviceLine(service, controller.options),
    value: service.service,
  }))

  if (controller.options.showIncidents && scoped.incidents.length > 0) {
    const first = scoped.incidents[0]
    services.unshift({
      title: `${t("panel.incidents")} (${scoped.incidents.length})`,
      description: first ? `${serviceLabel(t, first.service)} ${stateWord(t, first.state)}` : "",
      value: "__incidents__",
    })
  }

  const picked = await context.ui.dialog.select<string>({ title, options: services })
  if (!picked) return

  if (picked === "__incidents__") {
    await context.ui.dialog.alert({ title: t("panel.incidents"), message: incidentMessage(scoped.incidents) })
    return
  }

  const service = scoped.services.find((entry) => entry.service === picked)
  if (!service) return

  if (service.models.length === 0) {
    await context.ui.dialog.alert({
      title: serviceLabel(t, service.service),
      message: serviceLine(service, controller.options),
    })
    return
  }

  await context.ui.dialog.select<string>({
    title: serviceLabel(t, service.service),
    options: service.models.map((model) => ({
      title: model.id,
      description: modelLine(model, controller.options),
      value: model.id,
    })),
  })
}

export default Plugin.define({
  id: "provider-status-tui",

  setup(context) {
    const controller = createStatus(context)
    const options = controller.options
    const unregister: Array<() => void> = []

    if (options.tuiHomeFooter) {
      unregister.push(
        context.ui.slot({
          append: "home.footer.status",
          render: () => (
            <Footer
              label={() =>
                footerLabel(controller.view(), controller.scoped(), controller.stale(), options)
              }
            />
          ),
        }),
      )
    }

    if (options.tuiPromptFooter) {
      unregister.push(
        context.ui.slot({
          append: "prompt.footer.status",
          render: () => (
            <Footer
              label={() =>
                footerLabel(controller.view(), controller.scoped(), controller.stale(), options)
              }
            />
          ),
        }),
      )
    }

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "provider-status.open",
          title: t("panel.title"),
          group: t("plugin.title"),
          palette: true,
          slash: { name: "provider-status", aliases: ["pstatus"] },
          run: () => {
            void openDetail(context, controller)
          },
        },
        {
          id: "provider-status.refresh",
          title: t("panel.refresh"),
          group: t("plugin.title"),
          palette: true,
          run: () => {
            void controller.refresh()
          },
        },
      ],
    }))

    return () => {
      for (const off of unregister) off()
      controller.dispose()
    }
  },
})
