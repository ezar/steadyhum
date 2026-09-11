import type { ReactNode } from 'react'

import { useT } from '@/i18n/context.ts'

/** A plain horizontal meter in dBFS. Numbers are tabular so they stop jittering. */
export function LevelMeter({ levelDbfs }: { readonly levelDbfs: number | null }): ReactNode {
  const t = useT()
  const fraction = levelDbfs === null ? 0 : Math.max(0, Math.min(1, (levelDbfs + 60) / 60))
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-ink-soft">{t('check.level')}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-bone">
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{ width: `${(fraction * 100).toFixed(1)}%` }}
        />
      </div>
      <span className="tabular w-20 text-right text-sm text-ink-faint">
        {levelDbfs === null ? '—' : `${levelDbfs.toFixed(1)} dB`}
      </span>
    </div>
  )
}
