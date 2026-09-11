import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { listApplianceOverviews } from '@/db/repo.ts'
import type { ApplianceOverview } from '@/db/repo.ts'
import { useI18n } from '@/i18n/context.ts'
import { formatDate } from '@/lib/format.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { StatusChip } from '@/ui/StatusChip.tsx'

export function Home(): ReactNode {
  const { t } = useI18n()
  const overviews = useLiveQuery(() => listApplianceOverviews(), [], undefined)

  return (
    <AppShell
      title={t('home.title')}
      actions={
        <Link to="/settings" className="rounded-[var(--radius-pill)] p-2 hover:bg-bone">
          <span aria-hidden="true">⚙</span>
          <span className="sr-only">{t('nav.settings')}</span>
        </Link>
      }
    >
      {overviews === undefined ? null : overviews.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {overviews.map((overview) => (
            <ApplianceCard key={overview.appliance.id} overview={overview} />
          ))}
          <Link to="/appliances/new" className="mt-2">
            <Button variant="secondary" size="lg">
              {t('home.addAppliance')}
            </Button>
          </Link>
        </div>
      )}
    </AppShell>
  )
}

function EmptyState(): ReactNode {
  const { t } = useI18n()
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <h2 className="text-xl font-semibold">{t('home.empty.title')}</h2>
      <p className="max-w-sm text-ink-soft">{t('home.empty.body')}</p>
      <Link to="/appliances/new" className="mt-2 w-full max-w-xs">
        <Button size="lg">{t('home.empty.action')}</Button>
      </Link>
    </Card>
  )
}

function ApplianceCard({ overview }: { readonly overview: ApplianceOverview }): ReactNode {
  const { t, locale } = useI18n()
  const { appliance, status, lastCheck, enrollment } = overview
  const target = enrollment.learned
    ? `/appliances/${appliance.id}/check`
    : `/appliances/${appliance.id}/learn`

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/appliances/${appliance.id}`} className="block truncate text-lg font-semibold">
            {appliance.name}
          </Link>
          <p className="truncate text-sm text-ink-soft">{t(`applianceType.${appliance.type}`)}</p>
        </div>
        <StatusChip status={status} />
      </div>
      <p className="text-sm text-ink-faint">
        {t('home.lastCheck', {
          when: lastCheck === null ? t('common.never') : formatDate(lastCheck.createdAt, locale),
        })}
      </p>
      <Link to={target}>
        <Button size="lg">{enrollment.learned ? t('home.listenNow') : t('home.learnFirst')}</Button>
      </Link>
    </Card>
  )
}
