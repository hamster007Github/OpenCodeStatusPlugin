import type { Translate } from "../copy"
import { en } from "../gui/i18n"

/**
 * The TUI has no locale API of its own, so it follows the English dictionary.
 * The keys are the same ones the desktop surfaces use.
 */
export const t: Translate = (key) => en[key] ?? key
