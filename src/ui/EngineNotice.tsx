import type { ReactNode } from 'react'

import type { EngineAvailability } from '@/audio/engine.ts'
import { useT } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'

const messages: Record<EngineAvailability['kind'], MessageKey | null> = {
  ready: null,
  'not-installed': 'engine.notInstalled',
  'microphone-denied': 'engine.microphoneDenied',
  'unsupported-browser': 'engine.unsupportedBrowser',
  'model-load-failed': 'engine.modelLoadFailed',
  error: 'engine.unknown',
}

/**
 * Says plainly why listening is unavailable instead of letting a button sit
 * there doing nothing. Renders nothing when the engine is ready or still
 * starting.
 */
export function EngineNotice({
  availability,
}: {
  readonly availability: EngineAvailability | null
}): ReactNode {
  const t = useT()
  if (availability === null || availability.kind === 'ready') return null

  const key = messages[availability.kind]
  if (key === null) return null

  return (
    <div
      role="status"
      className="rounded-[var(--radius-card)] border border-hairline bg-bone px-4 py-3 text-sm text-ink-soft"
    >
      <p className="font-medium text-ink">{t('engine.title')}</p>
      <p className="mt-1">{t(key)}</p>
      {availability.kind === 'error' && (
        <p className="mt-1 text-ink-faint">{availability.message}</p>
      )}
    </div>
  )
}
