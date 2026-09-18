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
 * Octave-band features, named after the band's low edge: `band4000Hz`.
 *
 * These are not exotic: a real check on a washing machine reported one as its
 * strongest difference, in English, on a Spanish screen. They are also not
 * absolute levels — earshot stores each band minus the overall level — so the
 * copy says "carries more weight", not "is louder".
 */
const BAND_FEATURE = /^band(\d+)Hz$/

/**
 * One difference, in the reader's language.
 *
 * Shared by the verdict list and the shareable card on purpose. Two copies of
 * this would drift, and the card is the copy that leaves the device, so it is
 * the one where drifting would be least visible and most costly.
 */
export function describeDescriptor(descriptor: Descriptor, t: I18nValue['t']): string {
  if (TRANSLATED_FEATURES.has(descriptor.feature)) {
    return t(`descriptor.${descriptor.feature}.${descriptor.direction}` as MessageKey)
  }
  const band = BAND_FEATURE.exec(descriptor.feature)?.[1]
  if (band !== undefined) {
    const hz = Number(band)
    return t(`descriptor.band.${descriptor.direction}`, {
      zone: t(`descriptor.zone.${zoneOf(hz)}` as MessageKey),
      band: formatHz(hz),
    })
  }
  return descriptor.text
}

/** The measurement under a difference, in the reader's language. */
export function describeDetail(descriptor: Descriptor, t: I18nValue['t']): string {
  const values = {
    value: roundForDisplay(descriptor.value),
    reference: roundForDisplay(descriptor.reference),
  }
  // Flatness and periodicity are plain ratios. Passing an empty unit into the
  // sentence with a unit in it leaves two spaces where a word should be.
  return descriptor.unit === ''
    ? t('descriptor.detailPlain', values)
    : t('descriptor.detail', { ...values, unit: descriptor.unit })
}

/** Rounds a measured value for display: coarse when large, finer when small. */
export function roundForDisplay(value: number): string {
  const magnitude = Math.abs(value)
  if (magnitude >= 100) return value.toFixed(0)
  if (magnitude >= 1 || magnitude === 0) return value.toFixed(1)
  // A flatness of 0.023 reads as "0.0" at one decimal, and "0.0 against the
  // usual 0.0" is worse than saying nothing: it looks like nothing changed.
  return value.toPrecision(2)
}

/** Which end of the spectrum a band sits in, for copy a reader can picture. */
function zoneOf(hz: number): 'low' | 'mid' | 'high' {
  if (hz < 250) return 'low'
  if (hz < 2000) return 'mid'
  return 'high'
}

/** The band's low edge, the way earshot writes it in English. */
function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz` : `${Math.round(hz)} Hz`
}
