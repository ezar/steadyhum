import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useEngineAvailability } from '@/audio/useEngineAvailability.ts'
import { getApplianceOverview } from '@/db/repo.ts'
import { CHECK_SECONDS } from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { EngineNotice } from '@/ui/EngineNotice.tsx'
import { LevelMeter } from '@/ui/LevelMeter.tsx'
import { ListeningRing } from '@/ui/ListeningRing.tsx'

export function Check(): ReactNode {
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

  return (
    <AppShell title={t('check.title')} back={`/appliances/${appliance.id}`}>
      <div className="flex flex-col gap-4">
        <EngineNotice availability={availability} />
        <Card className="flex flex-col items-center gap-4 py-8">
          {/* The verdict is never shown mid-recording: no anxiety flicker. */}
          <ListeningRing
            progress={0}
            levelDbfs={null}
            label={`${CHECK_SECONDS}`}
            caption={t('check.hold')}
          />
          <div className="w-full">
            <LevelMeter levelDbfs={null} />
          </div>
          <Button size="lg" disabled={availability?.kind !== 'ready'}>
            {t('check.start')}
          </Button>
        </Card>
      </div>
    </AppShell>
  )
}
