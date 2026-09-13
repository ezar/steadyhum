import type { ReactNode } from 'react'

import type { TimelinePoint } from '@/audio/useWatch.ts'
import { DARK_STATUS_COLOUR } from './statusColours.ts'

/**
 * The session so far, as one strip.
 *
 * Bars rather than a line: the question a watch session answers is "when did
 * something happen", and a bar per moment reads as a sequence of moments. A
 * smooth line invites reading a trend into noise.
 *
 * SVG rather than canvas — a few hundred rects redraw fine, and it stays
 * crisp on any density without device-pixel-ratio bookkeeping.
 */
export function WatchTimeline({
  points,
  label,
}: {
  readonly points: readonly TimelinePoint[]
  readonly label: string
}): ReactNode {
  const height = 100
  const width = Math.max(points.length, 1)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-28 w-full"
    >
      {/* The normal band, so a bar's height is read against something. */}
      <rect x="0" y={height * 0.5} width={width} height={height * 0.5} fill="#1f2a28" />
      {points.map((point, index) => {
        const bar = Math.max(2, point.smoothed * height)
        return (
          <rect
            key={`${point.seconds}-${index}`}
            x={index}
            y={height - bar}
            width={1}
            height={bar}
            fill={DARK_STATUS_COLOUR[point.status]}
          />
        )
      })}
    </svg>
  )
}
