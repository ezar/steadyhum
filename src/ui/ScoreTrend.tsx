import type { ReactNode } from 'react'

import type { StoredCheck } from '@/db/schema.ts'
import { useT } from '@/i18n/context.ts'

const WIDTH = 320
const HEIGHT = 96
/** Window scores are clipped to [0, 8] z by the scorer (section 6.4). */
const MAX_SCORE = 8

/**
 * Check scores over time. A slowly rising line across weeks is the early
 * warning this product exists for, so the axis is fixed rather than
 * auto-scaled: a flat line must look flat.
 */
export function ScoreTrend({ checks }: { readonly checks: readonly StoredCheck[] }): ReactNode {
  const t = useT()
  const scored = [...checks].reverse().filter((check) => check.status !== 'unusable')

  if (scored.length < 2) {
    return <p className="text-ink-faint">{t('appliance.noChecks')}</p>
  }

  const step = WIDTH / (scored.length - 1)
  const points = scored
    .map((check, index) => {
      const x = index * step
      const y = HEIGHT - (Math.min(check.score, MAX_SCORE) / MAX_SCORE) * HEIGHT
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-24 w-full"
      role="img"
      aria-label={t('appliance.trend')}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
