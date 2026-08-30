import type { BCP47LanguageTag } from '@sovereignbase/utils'

/**
 * Generates canonical and language-alternate link markup for a localized page.
 *
 * Produces:
 * - a canonical link for the current language,
 * - `hreflang` alternate links for each supported alternate language,
 * - an `x-default` alternate link for the default language.
 *
 * @param host Registrable domain, such as `example.com` or `example.co.uk`.
 * @param defaultLanguage Language used for the `x-default` URL.
 * @param canonicalLanguage Language used for the canonical URL.
 * @param alternateLanguages Languages exposed through `hreflang` alternate links.
 * @param pathSuffix Optional path suffix starting with `/`.
 */
export const languageLinksMarkup = (
  host: `${string /* domain */}.${string /* public suffix */}`,
  defaultLanguage: BCP47LanguageTag,
  canonicalLanguage: BCP47LanguageTag,
  alternateLanguages: BCP47LanguageTag[],
  pathSuffix: '' | `/${string}` = ''
) => `
  <link rel="canonical" href="https://${host}/${canonicalLanguage}${pathSuffix}" />
  ${(() => {
    let markup = ``
    for (const language of alternateLanguages)
      markup += `  <link rel="alternate" hreflang="${language}" href="https://${host}/${language}${pathSuffix}" />`
    return markup
  })()}
  <link rel="alternate" hreflang="x-default" href="https://${host}/${defaultLanguage}${pathSuffix}" />
`
