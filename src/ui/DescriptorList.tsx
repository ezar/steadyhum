import type { Descriptor } from 'earshot'
import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import { describeDescriptor, roundForDisplay } from '@/lib/describeDescriptor.ts'

/**
 * How the check differs, in the user's language.
 *
 * The sentences come from {@link describeDescriptor}, shared with the
 * shareable card so the two cannot say different things about one check.
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
        const sentence = describeDescriptor(descriptor, t)
        return (
          <li key={descriptor.feature} className="flex flex-col gap-0.5">
            <span>{sentence}</span>
            <span className="tabular text-sm text-ink-faint">
              {t('descriptor.detail', {
                value: roundForDisplay(descriptor.value),
                reference: roundForDisplay(descriptor.reference),
                unit: descriptor.unit,
              })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
