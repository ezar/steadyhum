import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import type { GuardedWindow } from '@/audio/engine.ts'
import { useEngineAvailability } from '@/audio/useEngineAvailability.ts'
import { useRecorder } from '@/audio/useRecorder.ts'
import { saveCheck } from '@/db/record.ts'
import { getApplianceOverview } from '@/db/repo.ts'
import { CHECK_SECONDS } from '@/db/schema.ts'
import type { StoredCheck } from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import { nowIso } from '@/lib/id.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { EngineNotice } from '@/ui/EngineNotice.tsx'
import { GuardHint } from '@/ui/GuardHint.tsx'
import { LevelMeter } from '@/ui/LevelMeter.tsx'
import { ListeningRing } from '@/ui/ListeningRing.tsx'
import { Verdict } from '@/ui/Verdict.tsx'

export function Check(): ReactNode {
  const { t } = useI18n()
  const { applianceId = '' } = useParams()
  const availability = useEngineAvailability()
  const overview = useLiveQuery(() => getApplianceOverview(applianceId), [applianceId], undefined)
  const [startedAt, setStartedAt] = useState(nowIso)
  const [check, setCheck] = useState<StoredCheck | null>(null)
  const [scoring, setScoring] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const onFinished = useCallback(
    (windows: readonly GuardedWindow[]) => {
      if (windows.length === 0) return
      setScoring(true)
      setFailure(null)
      void saveCheck(applianceId, windows, startedAt)
        .then((outcome) => {
          setScoring(false)
          setCheck(outcome?.check ?? null)
        })
        .catch((error: unknown) => {
          setScoring(false)
          setFailure(error instanceof Error ? error.message : String(error))
        })
    },
    [applianceId, startedAt],
  )

  const recorder = useRecorder({ maxSeconds: CHECK_SECONDS, onFinished })

  if (overview === undefined) return null
  if (overview === null) {
    return (
      <AppShell title={t('errors.applianceNotFound')} back="/">
        <Card>{t('errors.applianceNotFound')}</Card>
      </AppShell>
    )
  }

  const { appliance, enrollment } = overview

  if (!enrollment.learned) {
    return (
      <AppShell title={t('check.title')} back={`/appliances/${appliance.id}`}>
        <Card className="flex flex-col gap-3">
          <p>{t('check.needsProfile')}</p>
          <Link to={`/appliances/${appliance.id}/learn`}>
            <Button size="lg">{t('home.learnFirst')}</Button>
          </Link>
        </Card>
      </AppShell>
    )
  }

  function handleStart(): void {
    setCheck(null)
    setStartedAt(nowIso())
    recorder.start()
  }

  // The verdict is shown only once the recording is over: a needle that drifts
  // toward "different" mid-check is anxiety, not information.
  const remaining = Math.max(0, CHECK_SECONDS - Math.round(recorder.elapsedSeconds))

  return (
    <AppShell title={t('check.title')} back={`/appliances/${appliance.id}`}>
      <div className="flex flex-col gap-4">
        <EngineNotice availability={availability} />

        {check === null ? (
          <Card className="flex flex-col items-center gap-4 py-8">
            <ListeningRing
              progress={recorder.elapsedSeconds / CHECK_SECONDS}
              levelDbfs={recorder.recording ? recorder.levelDbfs : null}
              label={`${remaining}`}
              caption={recorder.recording ? t('check.listening') : t('check.hold')}
            />
            <div className="w-full">
              <LevelMeter levelDbfs={recorder.recording ? recorder.levelDbfs : null} />
            </div>
            {recorder.recording && <GuardHint reasons={recorder.rejectedFor} />}
            {(recorder.error ?? failure) !== null && (
              <p role="alert" className="text-sm text-different">
                {recorder.error ?? failure}
              </p>
            )}
            <Button
              size="lg"
              disabled={availability?.kind !== 'ready' || recorder.recording || scoring}
              onClick={handleStart}
            >
              {recorder.recording ? t('check.listening') : t('check.start')}
            </Button>
          </Card>
        ) : (
          <Verdict applianceId={appliance.id} check={check} onRetry={handleStart} />
        )}
      </div>
    </AppShell>
  )
}
