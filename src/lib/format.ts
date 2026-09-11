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
