import { Schema } from "effect"
import { Plugin, Store } from "@opencode/plugin/gui"
import { de, en } from "./i18n"

/**
 * The settings store holds overrides only: a field the user never touched is
 * absent, so the plugin options stay in charge. That is also why a changed
 * option still takes effect after the user opened the settings page once.
 */
export const Prefs = Schema.Struct({
  services: Schema.optional(Schema.Array(Schema.String)),
  models: Schema.optional(Schema.Array(Schema.String)),
  allModels: Schema.optional(Schema.Boolean),
  showSpeed: Schema.optional(Schema.Boolean),
  showIncidents: Schema.optional(Schema.Boolean),
  showHistory: Schema.optional(Schema.Boolean),
  notify: Schema.optional(Schema.String),
  lights: Schema.optional(
    Schema.Struct({
      operational: Schema.optional(Schema.String),
      degraded: Schema.optional(Schema.String),
      outage: Schema.optional(Schema.String),
      unknown: Schema.optional(Schema.String),
      stale: Schema.optional(Schema.String),
    }),
  ),
})

export const definition = Plugin.define({
  stores: {
    prefs: Store.global(Prefs, {}),
  },
  i18n: { en, de },
})

/** The context every window setup and component uses. */
export type WindowContext = Parameters<Plugin.Setup<typeof definition>>[0]
