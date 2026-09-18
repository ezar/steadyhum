import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import { describeDescriptor } from '@/lib/describeDescriptor.ts'
import { formatDuration } from '@/lib/format.ts'
import type { WatchEpisode } from '@/lib/watchEpisodes.ts'
import { DARK_STATUS_COLOUR } from './statusColours.ts'

/**
 * The episodes of a watch session: when each happened, and how it sounded.
 *
 * Two things are said about an episode and they are not the same kind of
 * claim. The first line is a fact about the recording — between these two
 * times, it did not sound like this machine's learned normal. The lines under
 * it are measurements: which feature moved, which way. Neither is a diagnosis,
 * and the screen's closing note says so; the point of showing the
 * measurements at all is to give the reader something to listen for
 * themselves.
 */
export function EpisodeList({
  episodes,
  emptyText,
}: {
  readonly episodes: readonly WatchEpisode[]
  readonly emptyText: string
}): ReactNode {
  const { t } = useI18n()

  if (episodes.length === 0) return <p className="text-sm text-[#8d968f]">{emptyText}</p>

  return (
    <ul className="flex flex-col gap-3">
      {episodes.map((episode) => (
        <li key={`${episode.startSeconds}-${episode.endSeconds}`}>
          <p className="tabular text-sm" style={{ color: DARK_STATUS_COLOUR[episode.status] }}>
            {t(episode.fromDrift ? 'watch.segmentDrift' : 'watch.segment', {
              start: formatDuration(episode.startSeconds),
              end: formatDuration(episode.endSeconds),
              status: t(`status.${episode.status}`),
            })}
          </p>
          {/*
           * How it differed, when anything can be said about it. Often nothing
           * can — a feature has to move a good way before earshot will name it
           * — and an episode with no lines under it is the ordinary case, not
           * a gap to be filled with a hedge.
           */}
          {episode.descriptors.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-sm text-[#c9c4bb]">
              {episode.descriptors.map((descriptor) => (
                <li key={descriptor.feature}>{describeDescriptor(descriptor, t)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
