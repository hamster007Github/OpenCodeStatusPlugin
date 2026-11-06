/** Units only, so the copy around them stays translatable. */

export function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—"

  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`

  return `${Math.floor(hours / 24)} d`
}

export function formatTtft(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`
}

export function formatTps(tps: number | null): string | null {
  if (tps === null || !Number.isFinite(tps) || tps < 0) return null
  return `${Math.round(tps)} tok/s`
}

/** A local, short stamp for a history bucket or an incident. */
export function formatStamp(at: number | null): string | null {
  if (at === null || !Number.isFinite(at)) return null
  return new Date(at).toLocaleString()
}
