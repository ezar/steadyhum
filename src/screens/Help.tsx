import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'
import { AppShell } from '@/ui/AppShell.tsx'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'

/**
 * The questions this app actually provokes, answered where someone can find
 * them.
 *
 * Every entry is grounded in something the app really does — the four verdicts
 * it can return, the 40% noise threshold that makes a check unusable, the level
 * guard — rather than invented FAQ filler. Two of them exist because the honest
 * answer is "no": it will not name the broken part, and it is not something to
 * trust for gas.
 *
 * Ordered by when someone hits them: the honest limit first, then reading a
 * result, then recording well, then the things that go wrong.
 */
interface Question {
  readonly id: string
  readonly question: MessageKey
  readonly answer: MessageKey
  /** A second paragraph, where the short answer is not the whole answer. */
  readonly detail?: MessageKey
}

const QUESTIONS: readonly Question[] = [
  {
    id: 'whatBroke',
    question: 'help.q.whatBroke.q',
    answer: 'help.q.whatBroke.a',
    detail: 'help.q.whatBroke.b',
  },
  {
    id: 'verdicts',
    question: 'help.q.verdicts.q',
    answer: 'help.q.verdicts.a',
    detail: 'help.q.verdicts.b',
  },
  {
    id: 'recording',
    question: 'help.q.recording.q',
    answer: 'help.q.recording.a',
    detail: 'help.q.recording.b',
  },
  {
    id: 'unusable',
    question: 'help.q.unusable.q',
    answer: 'help.q.unusable.a',
    detail: 'help.q.unusable.b',
  },
  {
    id: 'falseAlarm',
    question: 'help.q.falseAlarm.q',
    answer: 'help.q.falseAlarm.a',
    detail: 'help.q.falseAlarm.b',
  },
  { id: 'levelGuard', question: 'help.q.levelGuard.q', answer: 'help.q.levelGuard.a' },
  { id: 'changed', question: 'help.q.changed.q', answer: 'help.q.changed.a' },
  {
    id: 'offline',
    question: 'help.q.offline.q',
    answer: 'help.q.offline.a',
    detail: 'help.q.offline.b',
  },
  { id: 'data', question: 'help.q.data.q', answer: 'help.q.data.a' },
  { id: 'gas', question: 'help.q.gas.q', answer: 'help.q.gas.a' },
]

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
