import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { applyUserVerdict } from '@/db/record.ts'
import { LEVEL_GUARD_DB } from '@/db/schema.ts'
import type { StoredCheck, UserVerdict } from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import { confidenceOf } from '@/lib/confidence.ts'
import type { EnrollmentProgress } from '@/db/repo.ts'
import { Button } from './Button.tsx'
import { Card } from './Card.tsx'
import { DescriptorList } from './DescriptorList.tsx'
import { StatusChip } from './StatusChip.tsx'

/**
 * The answer, in the order the design brief asks for: status first, explanation
 * second, descriptors third, feedback within thumb reach.
 */
export function Verdict({
  applianceId,
  check,
  enrollment,
  onRetry,
}: {
  readonly applianceId: string
  readonly check: StoredCheck
  readonly enrollment: EnrollmentProgress
  readonly onRetry: () => void
}): ReactNode {
  const { t } = useI18n()
  const [answered, setAnswered] = useState<UserVerdict | null>(check.verdict)
  const confidence = confidenceOf(check, enrollment)

  if (check.unusable) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t('verdict.unusable')}</h2>
        <p className="text-ink-soft">{t('verdict.unusableBody')}</p>
        <Button size="lg" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </Card>
    )
  }

  function answer(verdict: UserVerdict): void {
    setAnswered(verdict)
    void applyUserVerdict(applianceId, check, verdict)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t(`verdict.${check.status}`)}</h2>
          <StatusChip status={check.status} />
        </div>
        <p className="text-sm text-ink-soft">
          {t('confidence.label', { level: t(`confidence.${confidence.level}`) })}
        </p>
        {/*
         * Say why, whenever it is not high. A bare "confianza media" invites
         * the reader to invent a reason, and the reason is always something
         * they can act on: record again in the quiet, put the phone back where
         * it was, add a learning session.
         */}
        {confidence.reason !== null && (
          <p className="text-sm text-ink-faint">{t(`confidence.reason.${confidence.reason}`)}</p>
        )}
        <p className="tabular text-sm text-ink-faint">
          {t('verdict.matchedState', { state: check.dominantStateId })}
        </p>
        {Math.abs(check.levelDeltaDb) > LEVEL_GUARD_DB && (
          <p className="text-slight">{t('verdict.levelGuard')}</p>
        )}
      </Card>

      {check.descriptors.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h3 className="font-medium">{t('verdict.howItDiffers')}</h3>
          <DescriptorList descriptors={check.descriptors} />
          <p className="text-sm text-ink-faint">{t('verdict.askTechnician')}</p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h3 className="font-medium">{t('verdict.feedbackQuestion')}</h3>
        {answered === null ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                answer('normal')
              }}
            >
              {t('verdict.actuallyFine')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                answer('anomalous')
              }}
            >
              {t('verdict.actuallyBroken')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                answer('not-sure')
              }}
            >
              {t('verdict.notSure')}
            </Button>
          </div>
        ) : (
          <p role="status" className="text-normal">
            {t('verdict.feedbackThanks')}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onRetry}>
          {t('check.start')}
        </Button>
        <Link to={`/appliances/${applianceId}`}>
          <Button variant="ghost">{t('appliance.history')}</Button>
        </Link>
      </div>
    </div>
  )
}
