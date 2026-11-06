import {
  Command,
  ComposerPill,
  MenuItem,
  Panel,
  SettingsPage,
  Style,
  type PanelTab,
  type Plugin,
} from "@opencode/plugin/gui"
import { createStatus } from "./data"
import type { definition } from "./definition"
import { maybeNotify } from "./notify"
import { StatusPanel } from "./panel"
import { buildPill } from "./pill"
import { StatusSettings } from "./settings"
import { styles } from "./theme"

const TAB = "status"

export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const status = createStatus(ctx, (view) => maybeNotify(ctx, view))

  const openPanel = () => {
    const session = ctx.sessions.current()
    if (session) ctx.layout.open(`${ctx.id}:${TAB}`, session)
  }

  ctx.add(Command, (): Command => ({
    id: "open",
    title: ctx.t("command.open"),
    keywords: "status health provider go opencode",
    section: "session",
    enabled: !!ctx.sessions.current(),
    run: openPanel,
  }))

  ctx.add(ComposerPill, {
    id: TAB,
    order: 20,
    show: () => buildPill(ctx, status, openPanel),
  })

  const tab: PanelTab = {
    id: TAB,
    get title() {
      return ctx.t("panel.title")
    },
    closable: "compact",
  }

  ctx.add(Panel, {
    id: TAB,
    region: "side",
    mobile: {
      get title() {
        return ctx.t("panel.title")
      },
      order: 55,
      kind: "menu",
      icon: "status",
    },
    list: (input) => (input.open.includes(TAB) ? [tab] : []),
    focus: () => void status.reload(),
    render: () => <StatusPanel ctx={ctx} status={status} />,
  })

  ctx.add(MenuItem, (): MenuItem => ({
    menu: "session.panel",
    id: TAB,
    title: ctx.t("panel.title"),
    icon: "status",
    run: openPanel,
  }))

  ctx.add(SettingsPage, {
    id: TAB,
    icon: "status",
    get title() {
      return ctx.t("settings.title")
    },
    get entries() {
      return [
        { id: "status-service-go", title: ctx.t("settings.scope"), keywords: "services go free inference" },
        { id: "status-models-all", title: ctx.t("settings.models"), keywords: "models go inference" },
        { id: "status-speed", title: ctx.t("settings.speed"), keywords: "ttft speed tokens seconds" },
        { id: "status-incidents", title: ctx.t("settings.incidents"), keywords: "incidents updates" },
        { id: "status-history", title: ctx.t("settings.history"), keywords: "history seven days" },
        { id: "status-lights", title: ctx.t("settings.lights"), keywords: "pill emoji symbol light mark" },
        { id: "status-notify", title: ctx.t("settings.notify"), keywords: "notifications alerts" },
        { id: "status-endpoint", title: ctx.t("settings.endpoint"), keywords: "url api endpoint mirror" },
      ]
    },
    render: () => <StatusSettings ctx={ctx} status={status} />,
  })

  ctx.add(Style, styles)

  return () => status.dispose()
}
