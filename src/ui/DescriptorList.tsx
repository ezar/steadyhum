import type { Descriptor } from 'earshot'
import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'

/** The feature keys earshot's `DESCRIBABLE_FEATURES` can report. */
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

function round(value: number): string {
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)
}

/**
 * How the check differs, in the user's language.
 *
 * earshot ships a ready-made English sentence in `descriptor.text`, but UI copy
 * belongs in the dictionaries, so the sentence is rebuilt from the structured
 * fields — `feature` and `direction` — and `text` is only the fallback for a
 * feature this app has no phrasing for yet.
 */
export function DescriptorList({
  descriptors,
}: {
  readonly descriptors: readonly Descriptor[]
}): ReactNode {
  const { t } = useI18n()
  if (descriptors.length === 0) return null

  return (
    <ul className="flex flex-col gap-3">
      {descriptors.map((descriptor) => {
        const translated = TRANSLATED_FEATURES.has(descriptor.feature)
        const sentence = translated
          ? t(`descriptor.${descriptor.feature}.${descriptor.direction}` as MessageKey)
          : descriptor.text
        return (
          <li key={descriptor.feature} className="flex flex-col gap-0.5">
            <span>{sentence}</span>
            <span className="tabular text-sm text-ink-faint">
              {t('descriptor.detail', {
                value: round(descriptor.value),
                reference: round(descriptor.reference),
                unit: descriptor.unit,
              })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
