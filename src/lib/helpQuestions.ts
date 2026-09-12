import type { MessageKey } from '@/i18n/messages.ts'

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
export interface Question {
  readonly id: string
  readonly question: MessageKey
  readonly answer: MessageKey
  /** A second paragraph, where the short answer is not the whole answer. */
  readonly detail?: MessageKey
}

export const QUESTIONS: readonly Question[] = [
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
    id: 'confidence',
    question: 'help.q.confidence.q',
    answer: 'help.q.confidence.a',
    detail: 'help.q.confidence.b',
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
