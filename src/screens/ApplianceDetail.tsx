import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { db } from '@/db/index.ts'
import { deleteAppliance, getApplianceOverview, listChecks } from '@/db/repo.ts'
import { exportFileName, exportProfile } from '@/db/transfer.ts'
import { useI18n } from '@/i18n/context.ts'
import { formatDateTime } from '@/lib/format.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { ScoreTrend } from '@/ui/ScoreTrend.tsx'
import { StatusChip } from '@/ui/StatusChip.tsx'

export function ApplianceDetail(): ReactNode {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { applianceId = '' } = useParams()

  const overview = useLiveQuery(() => getApplianceOverview(applianceId), [applianceId], undefined)
  const checks = useLiveQuery(() => listChecks(applianceId), [applianceId], undefined)
  const hasProfile = useLiveQuery(
    async () => (await db.profiles.where('applianceId').equals(applianceId).count()) > 0,
    [applianceId],
    false,
  )

  if (overview === undefined) return null
  if (overview === null) {
    return (
      <AppShell title={t('errors.applianceNotFound')} back="/">
        <Card>{t('errors.applianceNotFound')}</Card>
      </AppShell>
    )
  }

  const { appliance, status, enrollment } = overview

  function handleExport(): void {
    void exportProfile(applianceId).then((payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = exportFileName(payload)
      anchor.click()
      URL.revokeObjectURL(url)
    })
  }

  function handleDelete(): void {
    if (!window.confirm(t('appliance.deleteConfirm', { name: appliance.name }))) return
    void deleteAppliance(applianceId).then(() => {
      void navigate('/', { replace: true })
    })
  }

  return (
    <AppShell title={appliance.name} back="/">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-ink-soft">{t(`applianceType.${appliance.type}`)}</p>
            <StatusChip status={status} />
          </div>
          {appliance.placementNote !== '' && (
            <p className="text-sm text-ink-faint">
              <span className="font-medium">{t('appliance.placement')}: </span>
              {appliance.placementNote}
            </p>
          )}
          <p className="tabular text-sm text-ink-soft">
            {t('enroll.progress', {
              sessions: enrollment.sessionCount,
              requiredSessions: 3,
              seconds: Math.round(enrollment.cleanSeconds),
              requiredSeconds: 180,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {enrollment.learned && (
              <Link to={`/appliances/${appliance.id}/check`}>
                <Button>{t('home.listenNow')}</Button>
              </Link>
            )}
            <Link to={`/appliances/${appliance.id}/learn`}>
              <Button variant="secondary">{t('appliance.relearn')}</Button>
            </Link>
            {hasProfile && (
              <Button variant="ghost" onClick={handleExport}>
                {t('appliance.export')}
              </Button>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('appliance.trend')}</h2>
          <ScoreTrend checks={checks ?? []} />
        </Card>

        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">{t('appliance.history')}</h2>
          {checks === undefined || checks.length === 0 ? (
            <p className="text-ink-faint">{t('appliance.noChecks')}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {checks.map((check) => (
                <li key={check.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-soft">
                      {formatDateTime(check.createdAt, locale)}
                    </p>
                    <p className="tabular text-sm text-ink-faint">{check.score.toFixed(2)} z</p>
                  </div>
                  <StatusChip status={check.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button variant="danger" onClick={handleDelete}>
          {t('common.delete')}
        </Button>
      </div>
    </AppShell>
  )
}
