import type { ReactNode } from 'react'

const SIZE = 220
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The signature element: a ring that fills over the length of a recording and
 * breathes with the input level. Its stroke stays neutral until the verdict, so
 * nothing on screen hints at an answer while the app is still listening.
 */
export function ListeningRing({
  progress,
  levelDbfs,
  label,
  caption,
}: {
  /** Completion in [0, 1]. */
  readonly progress: number
  /** Live input level in dBFS, or null when not recording. */
  readonly levelDbfs: number | null
  readonly label: string
  readonly caption?: string
}): ReactNode {
  const clamped = Math.max(0, Math.min(1, progress))
  // -60 dBFS is effectively silence, 0 dBFS is full scale.
  const level = levelDbfs === null ? 0 : Math.max(0, Math.min(1, (levelDbfs + 60) / 60))
  const breathe = 1 + level * 0.04

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative transition-transform duration-150"
        style={{ transform: `scale(${breathe.toFixed(3)})` }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clamped * 100)}
          aria-label={label}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-ink-soft)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="tabular text-3xl">{label}</span>
          {caption !== undefined && (
            <span className="px-6 text-center text-sm text-ink-soft">{caption}</span>
          )}
        </div>
      </div>
    </div>
  )
}
