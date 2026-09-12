import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import { listApplianceOverviews } from '@/db/repo.ts'
import type { ApplianceOverview } from '@/db/repo.ts'
import { useI18n } from '@/i18n/context.ts'
import { useSettings } from '@/store/settings.ts'
import { formatDate } from '@/lib/format.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'
import { StatusChip } from '@/ui/StatusChip.tsx'

export function Home(): ReactNode {
  const { t } = useI18n()
  const overviews = useLiveQuery(() => listApplianceOverviews(), [], undefined)
  const onboarded = useSettings((state) => state.onboarded)
  const setOnboarded = useSettings((state) => state.setOnboarded)

  // Someone who already has appliances is not a new user — they were here
  // before the introduction existed, or they imported a profile. Mark them
  // onboarded rather than interrupting them with it.
  const hasAppliances = overviews !== undefined && overviews.length > 0
  useEffect(() => {
    if (hasAppliances && !onboarded) setOnboarded(true)
  }, [hasAppliances, onboarded, setOnboarded])

  // Wait for the query: redirecting before it resolves would send an existing
  // user to the introduction for a frame.
  if (overviews === undefined) return null
  if (!onboarded && overviews.length === 0) return <Navigate to="/welcome" replace />

  return (
    <AppShell
      title={t('home.title')}
      actions={
        <>
          {/*
           * Help sits on Home, not only inside Settings. Someone staring at a
           * verdict they do not understand looks at the screen they are on;
           * making them go hunting through settings for an explanation is how
           * an app teaches people it has nothing to say.
           */}
          <Link to="/help" className="rounded-[var(--radius-pill)] p-2 hover:bg-bone">
            <span aria-hidden="true">?</span>
            <span className="sr-only">{t('nav.help')}</span>
          </Link>
          <Link to="/settings" className="rounded-[var(--radius-pill)] p-2 hover:bg-bone">
            <span aria-hidden="true">⚙</span>
            <span className="sr-only">{t('nav.settings')}</span>
          </Link>
        </>
      }
    >
      {overviews.length === 0 ? (
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
