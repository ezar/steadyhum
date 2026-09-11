import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'

import { useSettings } from '@/store/settings.ts'

import { I18nContext } from './context.ts'
import type { I18nValue } from './context.ts'
import { translate } from './messages.ts'

export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const locale = useSettings((state) => state.locale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nValue>(
    () => ({ locale, t: (key, vars) => translate(locale, key, vars) }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
