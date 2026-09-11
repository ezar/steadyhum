import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode, SubmitEventHandler } from 'react'

import { createAppliance } from '@/db/repo.ts'
import { APPLIANCE_TYPES } from '@/db/schema.ts'
import type { ApplianceType } from '@/db/schema.ts'
import { useI18n } from '@/i18n/context.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'

export function AddAppliance(): ReactNode {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [type, setType] = useState<ApplianceType>('washing-machine')
  const [name, setName] = useState('')
  const [placementNote, setPlacementNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (name.trim() === '') {
      setError(t('addAppliance.nameRequired'))
      return
    }
    setError(null)
    void createAppliance({ type, name, placementNote }).then((appliance) => {
      void navigate(`/appliances/${appliance.id}/learn`, { replace: true })
    })
  }

  return (
    <AppShell title={t('addAppliance.title')} back="/">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Card>
          <fieldset>
            <legend className="mb-3 font-medium">{t('addAppliance.typeLabel')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {APPLIANCE_TYPES.map((candidate) => (
                <label
                  key={candidate}
                  className={`flex min-h-16 cursor-pointer items-center rounded-[var(--radius-card)] border px-3 py-2 text-sm ${
                    candidate === type
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-hairline bg-card'
                  }`}
                >
                  <input
                    type="radio"
                    name="applianceType"
                    value={candidate}
                    checked={candidate === type}
                    onChange={() => {
                      setType(candidate)
                    }}
                    className="sr-only"
                  />
                  {t(`applianceType.${candidate}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('addAppliance.nameLabel')}</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              placeholder={t('addAppliance.namePlaceholder')}
              className="min-h-12 rounded-[var(--radius-card)] border border-hairline bg-paper px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('addAppliance.placementLabel')}</span>
            <textarea
              value={placementNote}
              onChange={(event) => {
                setPlacementNote(event.target.value)
              }}
              placeholder={t('addAppliance.placementPlaceholder')}
              rows={2}
              className="rounded-[var(--radius-card)] border border-hairline bg-paper px-3 py-2"
            />
            <span className="text-sm text-ink-faint">{t('addAppliance.placementHelp')}</span>
          </label>
        </Card>

        {error !== null && (
          <p role="alert" className="text-different">
            {error}
          </p>
        )}

        <Button type="submit" size="lg">
          {t('addAppliance.submit')}
        </Button>
      </form>
    </AppShell>
  )
}
