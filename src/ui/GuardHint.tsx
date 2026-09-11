import type { GuardReason } from 'earshot'
import type { ReactNode } from 'react'

import { useT } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'

const HINTS: Record<GuardReason, MessageKey> = {
  interference: 'enroll.noiseHint',
  silence: 'enroll.tooQuiet',
  'too-loud': 'enroll.tooLoud',
  clipping: 'enroll.clipping',
}

/**
 * The live "wait a moment" hint.
 *
 * Shown while recording so the user can fix the room rather than discover after
 * 60 seconds that the session was wasted.
 */
export function GuardHint({ reasons }: { readonly reasons: readonly GuardReason[] }): ReactNode {
  const t = useT()
  const reason = reasons[0]
  if (reason === undefined) return null
  return (
    <p role="status" className="text-center text-sm text-slight">
      {t(HINTS[reason])}
    </p>
  )
}
