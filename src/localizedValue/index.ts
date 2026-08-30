import type { BCP47LanguageTag } from '@sovereignbase/utils'
import type { Localized } from '../index.js'

/** Resolves a language value through requested, default, then empty fallback. */
export function localizedValue<T>(
  value: Localized<T> | undefined,
  language: BCP47LanguageTag,
  defaultLanguage: BCP47LanguageTag,
  empty: T
): T {
  if (value === undefined) return empty
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value as T
  }

  const values = value as Partial<Record<BCP47LanguageTag, T>>
  return values[language] ?? values[defaultLanguage] ?? empty
}
