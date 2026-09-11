import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] px-5 font-medium ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'

/** Big targets: the user is standing in a laundry room holding the phone. */
const sizes = { md: 'min-h-12 text-base', lg: 'min-h-14 text-lg w-full' } as const

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-ink',
  secondary: 'bg-accent-soft text-accent-ink hover:bg-bone',
  ghost: 'bg-transparent text-ink-soft hover:bg-bone',
  danger: 'bg-different-soft text-different hover:bg-different hover:text-white',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant
  readonly size?: keyof typeof sizes
  readonly children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps): ReactNode {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
