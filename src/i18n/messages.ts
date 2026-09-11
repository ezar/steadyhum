import en from './en.json'
import es from './es.json'

/** Spanish is the default locale; English is the second (section 7). */
export const LOCALES = ['es', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

const dictionaries = { es, en } as const

/** Dot paths of every leaf string in the Spanish dictionary. */
type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`
    }[keyof T & string]

export type MessageKey = Leaves<typeof es>

export type MessageVars = Readonly<Record<string, string | number>>

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

function lookup(dictionary: unknown, key: string): string | undefined {
  let node: unknown = dictionary
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, vars: MessageVars | undefined): string {
  if (vars === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * Resolves a message. Falls back to Spanish, then to the key itself, so a
 * missing translation is visible in development instead of rendering blank.
 *
 * A `count` of exactly 1 prefers a sibling `<key>_one` entry when one exists.
 */
export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const singular = vars?.['count'] === 1 ? `${key}_one` : null
  const dictionary = dictionaries[locale]
  const template =
    (singular === null ? undefined : lookup(dictionary, singular)) ??
    lookup(dictionary, key) ??
    (singular === null ? undefined : lookup(dictionaries[DEFAULT_LOCALE], singular)) ??
    lookup(dictionaries[DEFAULT_LOCALE], key) ??
    key
  return interpolate(template, vars)
}

/** The raw dictionaries, used by the key-parity test. */
export const rawDictionaries = dictionaries
