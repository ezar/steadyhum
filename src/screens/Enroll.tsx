import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useEngineAvailability } from '@/audio/useEngineAvailability.ts'
import { getApplianceOverview } from '@/db/repo.ts'
import {
  MIN_ENROLLMENT_CLEAN_SECONDS,
  MIN_ENROLLMENT_SESSIONS,
  RECOMMENDED_SESSION_SECONDS,
} from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { EngineNotice } from '@/ui/EngineNotice.tsx'
import { LevelMeter } from '@/ui/LevelMeter.tsx'
import { ListeningRing } from '@/ui/ListeningRing.tsx'

export function Enroll(): ReactNode {
  const { t } = useI18n()
  const { applianceId = '' } = useParams()
  const availability = useEngineAvailability()
  const overview = useLiveQuery(() => getApplianceOverview(applianceId), [applianceId], undefined)

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
            progress={0}
            levelDbfs={null}
            label={`0 / ${RECOMMENDED_SESSION_SECONDS}`}
            caption={t('enroll.start')}
          />
          <div className="w-full">
            <LevelMeter levelDbfs={null} />
          </div>
          <Button size="lg" disabled={!canRecord}>
            {t('enroll.start')}
          </Button>
        </Card>

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
