import { createContext, useContext } from 'react'

import { DEFAULT_LOCALE, translate } from './messages.ts'
import type { Locale, MessageKey, MessageVars } from './messages.ts'

export interface I18nValue {
  readonly locale: Locale
  readonly t: (key: MessageKey, vars?: MessageVars) => string
}

export const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
})

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

/** Shorthand for the common case of only needing the translate function. */
export function useT(): I18nValue['t'] {
  return useContext(I18nContext).t
}
