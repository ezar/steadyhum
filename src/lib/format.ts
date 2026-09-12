import type { Locale } from '@/i18n/messages.ts'

/** Short absolute date, e.g. "3 mar 2026". */
export function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Date and time, for history rows. */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Seconds as a whole number, for enrollment progress. */
export function formatSeconds(seconds: number): string {
  return Math.round(seconds).toString()
}

/**
 * Elapsed time as a clock, for a session that may run for hours.
 *
 * Hours appear only once there are any: "4:07" reads faster than "0:04:07",
 * and a watch session is usually minutes.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}
