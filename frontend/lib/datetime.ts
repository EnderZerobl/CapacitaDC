/** Older API responses omitted the suffix even though the stored value was UTC. */
export function asUtcDate(value: string): Date {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  return new Date(hasTimezone ? value : `${value}Z`)
}

/** Format an API instant for a datetime-local input in the browser's timezone. */
export function utcToLocalInput(value: string): string {
  const date = asUtcDate(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function localInputToUtc(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Informe uma data e um horário de liberação válidos.")
  }
  return date.toISOString()
}
