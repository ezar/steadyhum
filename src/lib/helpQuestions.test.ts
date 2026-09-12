import { describe, expect, it } from 'vitest'

import { QUESTIONS } from '@/lib/helpQuestions.ts'
import { rawDictionaries } from '@/i18n/messages.ts'

/**
 * Help renders a static list, so copy can exist in both dictionaries and be
 * unreachable on screen. That is not hypothetical: the confidence question was
 * written into both locales and never registered, so nobody could read it — the
 * same defect the change that introduced it had just set out to fix elsewhere.
 *
 * Key parity between locales does not catch this, because both were equally
 * wrong. Only the registry can.
 */
describe('the help registry', () => {
  const written = Object.keys(rawDictionaries.es.help.q)
  const registered = QUESTIONS.map((entry) => entry.id)

  it('renders every answer that has been written', () => {
    expect([...registered].sort()).toEqual([...written].sort())
  })

  it('points every entry at copy that exists, in both locales', () => {
    for (const entry of QUESTIONS) {
      for (const key of [entry.question, entry.answer, entry.detail]) {
        if (key === undefined) continue
        for (const [locale, dictionary] of Object.entries(rawDictionaries)) {
          const resolved = key
            .split('.')
            .reduce<unknown>(
              (node, segment) =>
                typeof node === 'object' && node !== null
                  ? (node as Record<string, unknown>)[segment]
                  : undefined,
              dictionary,
            )
          expect(typeof resolved, `${key} missing from ${locale}`).toBe('string')
        }
      }
    }
  })

  it('keeps the order the answers were written in, so the screen reads as intended', () => {
    expect(registered).toEqual(written)
  })
})
