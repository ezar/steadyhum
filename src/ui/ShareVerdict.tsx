import { useState } from 'react'
import type { ReactNode } from 'react'

import type { StoredCheck } from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'
import type { EnrollmentProgress } from '@/db/repo.ts'
import { confidenceOf } from '@/lib/confidence.ts'
import { describeDescriptor } from '@/lib/describeDescriptor.ts'
import { formatDateTime } from '@/lib/format.ts'
import { renderVerdictCard } from '@/lib/verdictCard.ts'
import { Button } from './Button.tsx'

type Outcome = 'idle' | 'working' | 'downloaded' | 'failed'

/**
 * Turns the verdict into an image and hands it to the phone's share sheet.
 *
 * Sharing a file is not universally supported, so this falls back to a
 * download rather than hiding the button: a saved PNG can still be attached to
 * a message by hand, which is the whole point of the feature.
 *
 * Only reachable for a check that produced a verdict — `Verdict` returns the
 * retry card before this for an unusable one — which is why nothing here
 * handles that case.
 */
export function ShareVerdict({
  applianceName,
  applianceType,
  check,
  enrollment,
}: {
  readonly applianceName: string
  readonly applianceType: string
  readonly check: StoredCheck
  readonly enrollment: EnrollmentProgress
}): ReactNode {
  const { t, locale } = useI18n()
  const [outcome, setOutcome] = useState<Outcome>('idle')

  async function share(): Promise<void> {
    setOutcome('working')
    const confidence = confidenceOf(check, enrollment)
    const differences = check.descriptors.map((descriptor) => describeDescriptor(descriptor, t))

    const blob = await renderVerdictCard({
      applianceName,
      applianceType,
      statusKind: check.status,
      statusLabel: t(`status.${check.status}`),
      headline: t(`verdict.${check.status}`),
      when: formatDateTime(check.createdAt, locale),
      confidence: t('confidence.label', { level: t(`confidence.${confidence.level}`) }),
      differences,
      differencesTitle: t('verdict.howItDiffers'),
      noDifferences: t('share.cardNoDifferences'),
      disclaimer: t('share.cardDisclaimer'),
      madeWith: t('share.cardMadeWith'),
    })

    const fileName = t('share.fileName', { name: slug(applianceName) })
    const file = new File([blob], fileName, { type: 'image/png' })

    /*
     * TypeScript's DOM lib types `share` and `canShare` as always present.
     * They are not: Firefox has neither, and a browser can have `share` for
     * text and still refuse a file. Ask the object rather than trusting the
     * types, and ask `canShare` about this exact file.
     */
    const shareApi = navigator as Partial<Pick<Navigator, 'canShare' | 'share'>>
    if (shareApi.share !== undefined && shareApi.canShare?.({ files: [file] }) === true) {
      try {
        await shareApi.share({
          files: [file],
          title: t('share.shareTitle', { name: applianceName }),
        })
        setOutcome('idle')
        return
      } catch (error) {
        // Dismissing the share sheet rejects with AbortError. That is the user
        // changing their mind, not a failure, and must not show an error.
        if (error instanceof DOMException && error.name === 'AbortError') {
          setOutcome('idle')
          return
        }
        // Anything else: fall through to the download, which still gets them
        // the image.
      }
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
    setOutcome('downloaded')
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        disabled={outcome === 'working'}
        onClick={() => {
          void share().catch(() => {
            setOutcome('failed')
          })
        }}
      >
        {outcome === 'working' ? t('share.preparing') : t('share.action')}
      </Button>
      {(outcome === 'downloaded' || outcome === 'failed') && (
        <p role="status" className="text-sm text-ink-soft">
          {t(`share.${outcome}` as MessageKey)}
        </p>
      )}
    </div>
  )
}

/** A file name that survives every filesystem, from a name the user typed. */
function slug(name: string): string {
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const cleaned = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned === '' ? 'aparato' : cleaned.slice(0, 40)
}
