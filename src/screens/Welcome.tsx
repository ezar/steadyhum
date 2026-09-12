import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useI18n } from '@/i18n/context.ts'
import type { MessageKey } from '@/i18n/messages.ts'
import { useSettings } from '@/store/settings.ts'
import { Button } from '@/ui/Button.tsx'
import { Card } from '@/ui/Card.tsx'

/**
 * The three things someone needs before they start, in the order they need
 * them: what this does and honestly does not do, where their audio goes, and
 * what it is going to ask of them before it is useful.
 *
 * The last one exists because the cost is real and front-loaded: three
 * recordings and a model download stand between opening the app and getting any
 * answer at all. Saying so up front is the difference between a user who waits
 * and a user who thinks it is broken.
 */
interface Step {
  readonly id: string
  readonly title: MessageKey
  readonly paragraphs: readonly MessageKey[]
  readonly notes?: readonly MessageKey[]
}

const STEPS: readonly Step[] = [
  {
    id: 'what',
    title: 'welcome.what.title',
    paragraphs: ['welcome.what.body', 'welcome.what.honest'],
  },
  {
    id: 'privacy',
    title: 'welcome.privacy.title',
    paragraphs: ['welcome.privacy.body', 'welcome.privacy.detail'],
  },
  {
    id: 'effort',
    title: 'welcome.effort.title',
    paragraphs: ['welcome.effort.body', 'welcome.effort.detail'],
    notes: ['welcome.effort.wifi', 'welcome.effort.tip'],
  },
]

export function Welcome(): ReactNode {
  const { t } = useI18n()
  const navigate = useNavigate()
  const setOnboarded = useSettings((state) => state.setOnboarded)
  const [index, setIndex] = useState(0)

  const step = STEPS[index]
  if (step === undefined) return null
  const last = index === STEPS.length - 1

  function finish(): void {
    setOnboarded(true)
    void navigate('/appliances/new', { replace: true })
  }

  function dismiss(): void {
    setOnboarded(true)
    void navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-paper px-4 py-6">
      <header className="flex items-center justify-between">
        <p className="tabular text-sm text-ink-faint">
          {t('welcome.step', { current: index + 1, total: STEPS.length })}
        </p>
        <Button variant="ghost" onClick={dismiss}>
          {t('welcome.skip')}
        </Button>
      </header>

      <main className="flex flex-1 flex-col justify-center py-6">
        <Card className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{t(step.title)}</h1>
          {step.paragraphs.map((key) => (
            <p key={key} className="text-ink-soft">
              {t(key)}
            </p>
          ))}
          {step.notes !== undefined && (
            <ul className="flex flex-col gap-2 border-t border-hairline pt-4">
              {step.notes.map((key) => (
                <li key={key} className="text-sm text-ink-faint">
                  {t(key)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      <footer className="flex flex-col gap-4">
        <ol className="flex justify-center gap-2" aria-hidden="true">
          {STEPS.map((candidate, position) => (
            <li
              key={candidate.id}
              className={`h-2 w-2 rounded-[var(--radius-pill)] ${
                position === index ? 'bg-accent' : 'bg-hairline'
              }`}
            />
          ))}
        </ol>
        <Button
          size="lg"
          onClick={
            last
              ? finish
              : () => {
                  setIndex(index + 1)
                }
          }
        >
          {last ? t('welcome.start') : t('welcome.next')}
        </Button>
      </footer>
    </div>
  )
}
