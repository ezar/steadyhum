import type { ReactNode } from 'react'

import type { ApplianceStatus } from '@/db/repo.ts'
import { useT } from '@/i18n/context.ts'

/** Every status is conveyed by colour, icon and text, never colour alone. */
const styles: Record<ApplianceStatus, { readonly className: string; readonly icon: string }> = {
  learning: { className: 'bg-accent-soft text-accent-ink', icon: '◍' },
  'never-checked': { className: 'bg-unusable-soft text-unusable', icon: '○' },
  normal: { className: 'bg-normal-soft text-normal', icon: '✓' },
  watch: { className: 'bg-slight-soft text-slight', icon: '≈' },
  anomalous: { className: 'bg-different-soft text-different', icon: '!' },
  unusable: { className: 'bg-unusable-soft text-unusable', icon: '–' },
}

export function StatusChip({ status }: { readonly status: ApplianceStatus }): ReactNode {
  const t = useT()
  const style = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-sm font-medium ${style.className}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      {t(`status.${status}`)}
    </span>
  )
}
