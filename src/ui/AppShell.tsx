import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useT } from '@/i18n/context.ts'

export function AppShell({
  title,
  back,
  actions,
  children,
}: {
  readonly title: string
  readonly back?: string
  readonly actions?: ReactNode
  readonly children: ReactNode
}): ReactNode {
  const t = useT()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-paper">
      <header className="sticky top-0 z-10 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          {back !== undefined && (
            <Link
              to={back}
              className="rounded-[var(--radius-pill)] px-2 py-1 text-ink-soft hover:bg-bone"
            >
              <span aria-hidden="true">←</span> {t('common.back')}
            </Link>
          )}
          <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
          {actions}
        </div>
      </header>
      <main className="flex-1 px-4 py-4 pb-24">{children}</main>
    </div>
  )
}
