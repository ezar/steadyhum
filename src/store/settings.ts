import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_LOCALE, isLocale } from '@/i18n/messages.ts'
import type { Locale } from '@/i18n/messages.ts'
import { WINDOW_RETENTION_DAYS } from '@/db/schema.ts'

export interface SettingsState {
  readonly locale: Locale
  /** P1: CLAP embeddings and zero-shot descriptors, off by default (6.1). */
  readonly deeperAnalysis: boolean
  /** Keep short audio clips around anomalies, on this device only. */
  readonly keepClips: boolean
  /** Days before window-level rows are pruned. */
  readonly retentionDays: number
  setLocale: (locale: Locale) => void
  setDeeperAnalysis: (enabled: boolean) => void
  setKeepClips: (enabled: boolean) => void
  setRetentionDays: (days: number) => void
}

function initialLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const preferred = navigator.languages.map((tag) => tag.split('-')[0])
  return preferred.find(isLocale) ?? DEFAULT_LOCALE
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      locale: initialLocale(),
      deeperAnalysis: false,
      keepClips: false,
      retentionDays: WINDOW_RETENTION_DAYS,
      setLocale: (locale) => {
        set({ locale })
      },
      setDeeperAnalysis: (deeperAnalysis) => {
        set({ deeperAnalysis })
      },
      setKeepClips: (keepClips) => {
        set({ keepClips })
      },
      setRetentionDays: (retentionDays) => {
        set({ retentionDays })
      },
    }),
    {
      name: 'steadyhum.settings',
      partialize: (state) => ({
        locale: state.locale,
        deeperAnalysis: state.deeperAnalysis,
        keepClips: state.keepClips,
        retentionDays: state.retentionDays,
      }),
    },
  ),
)
