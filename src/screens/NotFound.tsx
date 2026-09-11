import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'

export function NotFound(): ReactNode {
  const { t } = useI18n()
  return (
    <AppShell title={t('errors.notFound')}>
      <Card className="flex flex-col items-center gap-4 py-10">
        <p>{t('errors.notFound')}</p>
        <Link to="/">
          <Button>{t('nav.home')}</Button>
        </Link>
      </Card>
    </AppShell>
  )
}
