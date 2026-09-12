import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import { QUESTIONS } from '@/lib/helpQuestions.ts'
import type { Question } from '@/lib/helpQuestions.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'

export function Help(): ReactNode {
  const { t } = useI18n()

  return (
    <AppShell title={t('help.title')} back="/">
      <div className="flex flex-col gap-4">
        <p className="text-ink-soft">{t('help.intro')}</p>

        <div className="flex flex-col gap-2">
          {QUESTIONS.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </div>

        <Card className="flex flex-col gap-3">
          <h2 className="font-medium">{t('help.replayTitle')}</h2>
          <p className="text-sm text-ink-soft">{t('help.replayBody')}</p>
          <Link to="/welcome">
            <Button variant="secondary" size="lg">
              {t('help.replayAction')}
            </Button>
          </Link>
        </Card>

        <Link to="/privacy">
          <Button variant="ghost" size="lg">
            {t('help.privacyAction')}
          </Button>
        </Link>
      </div>
    </AppShell>
  )
}

/**
 * Collapsed by default: ten open answers is a wall of text, and someone
 * arriving with one question should be able to see all ten headings at once.
 *
 * `<details>` rather than state of our own — it is keyboard accessible for
 * free, and the browser's find-in-page can open it to reach a match inside.
 */
function Entry({ entry }: { readonly entry: Question }): ReactNode {
  const { t } = useI18n()
  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-medium">
          {t(entry.question)}
          <span aria-hidden="true" className="text-ink-faint group-open:hidden">
            +
          </span>
          <span aria-hidden="true" className="hidden text-ink-faint group-open:inline">
            −
          </span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-hairline p-4 text-ink-soft">
          <p>{t(entry.answer)}</p>
          {entry.detail !== undefined && <p>{t(entry.detail)}</p>}
        </div>
      </details>
    </Card>
  )
}
