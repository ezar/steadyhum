import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
}: {
  readonly children: ReactNode
  readonly className?: string
}): ReactNode {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-hairline bg-card p-4 shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </section>
  )
}
