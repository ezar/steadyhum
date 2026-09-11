import { describe, expect, it } from 'vitest'

import { LOCALES, rawDictionaries, translate } from './messages.ts'

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix === '' ? key : `${prefix}.${key}`),
  )
}

describe('dictionaries', () => {
  it('have the same keys in every locale', () => {
    const spanish = leafPaths(rawDictionaries.es).sort()
    for (const locale of LOCALES) {
      expect(leafPaths(rawDictionaries[locale]).sort(), locale).toEqual(spanish)
    }
  })

  it('has no empty string anywhere', () => {
    for (const locale of LOCALES) {
      const dictionary = rawDictionaries[locale]
      for (const path of leafPaths(dictionary)) {
        expect(translate(locale, path as never).trim(), `${locale}:${path}`).not.toBe('')
      }
    }
  })
})

describe('translate', () => {
  it('interpolates named variables', () => {
    expect(translate('en', 'home.lastCheck', { when: 'today' })).toBe('Last check: today')
  })

  it('leaves unknown placeholders alone instead of printing undefined', () => {
    expect(translate('en', 'home.lastCheck')).toBe('Last check: {when}')
  })

  it('prefers a _one entry when count is exactly 1', () => {
    expect(translate('en', 'enroll.statesFound', { count: 1 })).toBe(
      'I found 1 sound state in this recording.',
    )
    expect(translate('en', 'enroll.statesFound', { count: 3 })).toBe(
      'I found 3 distinct sound states in this recording.',
    )
  })

  it('falls back to Spanish when a key is missing in the other locale', () => {
    expect(translate('en', 'app.name')).toBe('SteadyHum')
  })
})
