import type { Descriptor } from 'earshot'

import type { I18nValue } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'

/**
 * The feature keys this app has its own phrasing for.
 *
 * earshot ships a ready-made English sentence in `descriptor.text`, but UI copy
 * belongs in the dictionaries, so the sentence is rebuilt from the structured
 * fields. `text` is only the fallback for a feature nothing here phrases yet —
 * English in a Spanish screen is poor, but silence about a real difference is
 * worse.
 */
const TRANSLATED_FEATURES = new Set([
  'level',
  'spectralFlatness',
  'spectralCentroidHz',
  'spectralFlux',
  'onsetPeriodicity',
  'amplitudeModulationHz',
  'amplitudeModulationDepth',
  'peakFrequencyHz',
  'peakProminenceDb',
])

/**
 * One difference, in the reader's language.
 *
 * Shared by the verdict list and the shareable card on purpose. Two copies of
 * this would drift, and the card is the copy that leaves the device, so it is
 * the one where drifting would be least visible and most costly.
 */
export function describeDescriptor(descriptor: Descriptor, t: I18nValue['t']): string {
  if (!TRANSLATED_FEATURES.has(descriptor.feature)) return descriptor.text
  return t(`descriptor.${descriptor.feature}.${descriptor.direction}` as MessageKey)
}

/** Rounds a measured value for display: coarse when large, one decimal when small. */
export function roundForDisplay(value: number): string {
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)
}
