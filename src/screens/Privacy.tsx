import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Card } from '@/ui/Card.tsx'

export function Privacy(): ReactNode {
  const { t } = useI18n()
  return (
    <AppShell title={t('privacy.title')} back="/settings">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{t('privacy.headline')}</h2>
          <p className="text-ink-soft">{t('privacy.body')}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-medium">{t('privacy.storedTitle')}</h2>
          <ul className="list-disc pl-5 text-ink-soft">
            <li>{t('privacy.storedAudio')}</li>
            <li>{t('privacy.storedProfiles')}</li>
            <li>{t('privacy.storedHistory')}</li>
          </ul>
        </Card>
        <Card>
          <p className="text-sm text-ink-faint">{t('privacy.disclaimer')}</p>
        </Card>
      </div>
    </AppShell>
  )
}
