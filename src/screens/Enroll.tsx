import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useEngineAvailability } from '@/audio/useEngineAvailability.ts'
import { useRecorder } from '@/audio/useRecorder.ts'
import type { GuardedWindow } from '@/audio/engine.ts'
import { saveEnrollmentSession } from '@/db/record.ts'
import { getApplianceOverview } from '@/db/repo.ts'
import {
  MIN_ENROLLMENT_CLEAN_SECONDS,
  MIN_ENROLLMENT_SESSIONS,
  RECOMMENDED_SESSION_SECONDS,
} from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import { nowIso } from '@/lib/id.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { EngineNotice } from '@/ui/EngineNotice.tsx'
import { GuardHint } from '@/ui/GuardHint.tsx'
import { LevelMeter } from '@/ui/LevelMeter.tsx'
import { ListeningRing } from '@/ui/ListeningRing.tsx'

export function Enroll(): ReactNode {
  const { t } = useI18n()
  const { applianceId = '' } = useParams()
  const availability = useEngineAvailability()
  const overview = useLiveQuery(() => getApplianceOverview(applianceId), [applianceId], undefined)
  const [startedAt, setStartedAt] = useState(nowIso)
  const [statesDiscovered, setStatesDiscovered] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const onFinished = useCallback(
    (windows: readonly GuardedWindow[]) => {
      if (windows.length === 0) return
      setFailure(null)
      void saveEnrollmentSession(applianceId, windows, startedAt)
        .then((outcome) => {
          setStatesDiscovered(outcome.statesDiscovered)
        })
        .catch((error: unknown) => {
          // Learning can legitimately fail — too few distinct windows, for one.
          // Saying so beats a screen that silently never reaches "learned".
          setFailure(error instanceof Error ? error.message : String(error))
        })
    },
    [applianceId, startedAt],
  )

  const recorder = useRecorder({ onFinished })

  if (overview === undefined) return null
  if (overview === null) {
    return (
      <AppShell title={t('errors.applianceNotFound')} back="/">
        <Card>{t('errors.applianceNotFound')}</Card>
      </AppShell>
    )
  }

  const { appliance, enrollment } = overview
  const canRecord = availability?.kind === 'ready'
  const progress = Math.min(1, recorder.elapsedSeconds / RECOMMENDED_SESSION_SECONDS)

  function handleStart(): void {
    setStatesDiscovered(null)
    setStartedAt(nowIso())
    recorder.start()
  }

  return (
    <AppShell title={t('enroll.title')} back={`/appliances/${appliance.id}`}>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <p>{t('enroll.intro')}</p>
          <p className="text-sm text-ink-faint">{t('enroll.addMore')}</p>
        </Card>

        <EngineNotice availability={availability} />

        <Card className="flex flex-col items-center gap-4 py-6">
          <ListeningRing
            progress={progress}
            levelDbfs={recorder.recording ? recorder.levelDbfs : null}
            label={`${Math.round(recorder.elapsedSeconds)} / ${RECOMMENDED_SESSION_SECONDS}`}
            caption={recorder.recording ? t('check.listening') : t('enroll.start')}
          />
          <div className="w-full">
            <LevelMeter levelDbfs={recorder.recording ? recorder.levelDbfs : null} />
          </div>
          {recorder.recording && <GuardHint reasons={recorder.rejectedFor} />}
          {recorder.unhonouredConstraints.length > 0 && (
            <p role="status" className="text-sm text-slight">
              {t('engine.processingFlags')}
            </p>
          )}
          {recorder.error !== null && (
            <p role="alert" className="text-sm text-different">
              {recorder.error}
            </p>
          )}
          <Button
            size="lg"
            disabled={!canRecord}
            onClick={recorder.recording ? recorder.stop : handleStart}
          >
            {recorder.recording ? t('enroll.stop') : t('enroll.start')}
          </Button>
        </Card>

        {statesDiscovered !== null && (
          <Card>
            <p>{t('enroll.statesFound', { count: statesDiscovered })}</p>
          </Card>
        )}

        {failure !== null && (
          <Card>
            <p role="alert" className="text-different">
              {t('enroll.learnFailed')}
            </p>
            <p className="mt-1 text-sm text-ink-faint">{failure}</p>
          </Card>
        )}

        <Card className="flex flex-col gap-2">
          <p className="tabular">
            {t('enroll.progress', {
              sessions: enrollment.sessionCount,
              requiredSessions: MIN_ENROLLMENT_SESSIONS,
              seconds: Math.round(enrollment.cleanSeconds),
              requiredSeconds: MIN_ENROLLMENT_CLEAN_SECONDS,
            })}
          </p>
          <div className="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-bone">
            <div
              className="h-full bg-accent"
              style={{ width: `${(enrollment.fraction * 100).toFixed(1)}%` }}
            />
          </div>
          <p className={enrollment.learned ? 'text-normal' : 'text-ink-faint'}>
            {enrollment.learned ? t('enroll.learned') : t('enroll.notLearned')}
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
