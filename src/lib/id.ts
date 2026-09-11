/** Random identifier for locally created rows. Never leaves the device. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Current time as an ISO 8601 string, the one timestamp format used in storage. */
export function nowIso(): string {
  return new Date().toISOString()
}
