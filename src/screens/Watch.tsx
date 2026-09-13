import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useWatch } from '@/audio/useWatch.ts'
import type { WatchEpisode, Watcher } from '@/audio/useWatch.ts'
import { getActiveProfile, getApplianceOverview } from '@/db/repo.ts'
import { useI18n } from '@/i18n/context.ts'
import { formatDuration } from '@/lib/format.ts'
import { Button } from '@/ui/Button.tsx'
import { EpisodeList } from '@/ui/EpisodeList.tsx'
import { DARK_STATUS_COLOUR } from '@/ui/statusColours.ts'
import { WatchTimeline } from '@/ui/WatchTimeline.tsx'

/**
 * Watch mode: continuous listening, on its own dark screen.
 *
 * Dark because of where it is used — a phone left on a worktop or a shelf for
 * an hour, often at night, glowing at the room. It is also the one screen
 * meant to be glanced at from across the kitchen rather than read, so the
 * state has to be legible at a distance: one big word, one strip.
 */
export function Watch(): ReactNode {
  const { t } = useI18n()
  const { applianceId = '' } = useParams()
  const overview = useLiveQuery(() => getApplianceOverview(applianceId), [applianceId], undefined)
  /*
   * Gate on the profile itself, not on enrolment progress.
   *
   * They can disagree: enough sessions can be recorded while learning still
   * fails to produce a profile, and then a screen that trusts progress offers
   * to start something that cannot start. Ask for the thing actually needed.
   */
  const profile = useLiveQuery(() => getActiveProfile(applianceId), [applianceId], undefined)
  const watcher = useWatch(applianceId)

  if (overview === undefined || profile === undefined) return null
  if (overview === null) {
    return <Shell title={t('errors.applianceNotFound')} applianceId={applianceId} />
  }

  const { appliance } = overview

  if (profile === null) {
    return (
      <Shell title={appliance.name} applianceId={applianceId}>
        <p className="text-[#c9c4bb]">{t('watch.needsProfile')}</p>
        <Link to={`/appliances/${applianceId}/learn`}>
          <Button size="lg">{t('home.learnFirst')}</Button>
        </Link>
      </Shell>
    )
  }

  return (
    <Shell title={appliance.name} applianceId={applianceId}>
      {watcher.watching ? <Live watcher={watcher} /> : <Idle watcher={watcher} />}
    </Shell>
  )
}

function Live({ watcher }: { readonly watcher: Watcher }): ReactNode {
  const { t } = useI18n()
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-[#8d968f]">{t('watch.listening')}</p>
        <p className="text-4xl font-semibold" style={{ color: DARK_STATUS_COLOUR[watcher.status] }}>
          {t(`status.${watcher.status}`)}
        </p>
        <p className="tabular text-[#c9c4bb]">
          {t('watch.elapsed', { time: formatDuration(watcher.elapsedSeconds) })}
        </p>
      </div>

      <WatchTimeline points={watcher.timeline} label={t('watch.timelineLabel')} />

      {/*
       * Drift gets its own line rather than another status colour. It is a
       * different kind of claim — nothing sounds wrong right now, the baseline
       * has been climbing — and collapsing it into the status would lose that.
       */}
      {watcher.drifting && (
        <p className="rounded-[var(--radius-card)] bg-[#3a3020] p-3 text-[#e8c877]">
          {t('watch.drift')}
        </p>
      )}

      <Segments segments={watcher.segments} />

      <p className="text-sm text-[#8d968f]">
        {watcher.screenHeldAwake ? t('watch.screenAwake') : t('watch.screenMaySleep')}
      </p>

      <Button size="lg" onClick={watcher.stop}>
        {t('watch.stop')}
      </Button>
    </>
  )
}

function Idle({ watcher }: { readonly watcher: Watcher }): ReactNode {
  const { t } = useI18n()
  const finished = watcher.elapsedSeconds > 0

  return (
    <>
      {finished ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">{t('watch.summaryTitle')}</h2>
          <p className="tabular text-[#c9c4bb]">
            {t('watch.summaryDuration', { time: formatDuration(watcher.elapsedSeconds) })}
          </p>
          <p className="text-[#c9c4bb]">
            {watcher.segments.length === 0
              ? t('watch.summaryNone')
              : t('watch.summaryCount', { count: watcher.segments.length })}
          </p>
          {watcher.segments.length > 0 && (
            <p className="text-sm text-[#8d968f]">{t('watch.honest')}</p>
          )}
        </div>
      ) : (
        <p className="text-[#c9c4bb]">{t('watch.intro')}</p>
      )}

      {/*
       * Only when there is something to list. On a finished session the line
       * above already says nothing happened, and "nothing to report so far"
       * under it both repeats it and implies the session is still running.
       */}
      {finished && watcher.segments.length > 0 && <Segments segments={watcher.segments} />}

      {/*
       * Never show the raw failure. Whatever earshot or the browser said is a
       * developer's sentence in the wrong language; the reader gets something
       * they can act on, and the detail goes to the console.
       */}
      {watcher.error !== null && <p className="text-[#e0705a]">{t('watch.failed')}</p>}

      <Button size="lg" onClick={watcher.start}>
        {finished ? t('watch.again') : t('watch.start')}
      </Button>
    </>
  )
}

function Segments({ segments }: { readonly segments: readonly WatchEpisode[] }): ReactNode {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium">{t('watch.segments')}</h3>
      <EpisodeList episodes={segments} emptyText={t('watch.noSegments')} />
    </div>
  )
}

/**
 * Its own shell rather than AppShell: this screen is dark, and threading a
 * theme through the shared one to serve a single screen would make every other
 * screen carry the idea.
 */
function Shell({
  title,
  applianceId,
  children,
}: {
  readonly title: string
  readonly applianceId: string
  readonly children?: ReactNode
}): ReactNode {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#14100c] text-[#f2ede4]">
      <header className="flex items-center gap-3 border-b border-[#2a241d] px-4 py-3">
        <Link to={`/appliances/${applianceId}`} className="rounded-[var(--radius-pill)] px-2 py-1">
          <span aria-hidden="true">←</span> {t('common.back')}
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-4 py-5">{children}</main>
    </div>
  )
}
