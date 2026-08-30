import type { BCP47LanguageTag, OpenGraphLocale } from '@sovereignbase/utils'
import type { Localized, PWAizeConfig } from '../index.js'
import { localizedValue } from '../localizedValue/index.js'
import type {
  DocumentMarkupOptions,
  HTTPSUrl,
  URLPath,
} from '../types/index.js'
import type { WebManifestOptions } from '../webManifest/index.js'

/** Resolves the shared public configuration for one generated language. */
export function localizeConfig(
  config: PWAizeConfig,
  language: BCP47LanguageTag,
  languages: BCP47LanguageTag[]
): {
  document: Omit<
    DocumentMarkupOptions,
    'entrypoint' | 'language' | 'manifestUrl' | 'stylesheet'
  >
  manifest: WebManifestOptions
} {
  const get = <T>(value: Localized<T> | undefined, empty: T): T =>
    localizedValue(value, language, config.defaultLanguage, empty)
  const applicationName = get(config.applicationName, '')
  const description = get(config.description, '')
  const icon192 = get<string>(config.icons.icon192, '')
  const icon512 = get<string>(config.icons.icon512, '')
  const origin = get<string>(config.origin, '')
  const pageUrl = (
    origin === '' ? '' : new URL(`/${language}`, origin).href
  ) as HTTPSUrl
  const organizationLogo = (
    origin === '' || icon512 === '' ? '' : new URL(icon512, origin).href
  ) as HTTPSUrl
  const themeColor = get(config.themeColor, '')
  const title = get(config.title, '')

  return {
    document: {
      applicationName,
      appleStatusBarStyle: get(config.appleStatusBarStyle, 'black-translucent'),
      appleTouchIconUrl: get(
        config.icons.appleTouchIconUrl,
        icon192 as URLPath
      ),
      bodyMarkup: get(config.bodyMarkup, ''),
      colorScheme: get(config.colorScheme, 'light dark'),
      headMarkup: get(config.headMarkup, ''),
      iconUrl: get(config.icons.iconUrl, icon512 as URLPath),
      maskIconColor: themeColor,
      maskIconUrl: get(config.icons.maskIconUrl, '' as URLPath),
      seo: {
        jsonLD: {
          application: {
            applicationCategory: get(config.application?.category, ''),
            browserRequirements: get(
              config.application?.browserRequirements,
              ''
            ),
            featureList: get(config.application?.featureList, []),
            inLanguage: languages,
            name: applicationName,
            operatingSystem: get(config.application?.operatingSystem, ''),
            url: origin as HTTPSUrl,
          },
          organization: {
            logo: get(config.organization?.logoUrl, organizationLogo),
            name: get(config.organization?.name, applicationName),
            url: get<string>(config.organization?.url, origin) as HTTPSUrl,
          },
          page: {
            description,
            inLanguage: language,
            name: title,
            url: pageUrl,
          },
          site: { name: applicationName, url: origin as HTTPSUrl },
        },
        languageLinks: {
          alternateLanguages: languages,
          canonicalLanguage: config.canonicalLanguage,
          defaultLanguage: config.defaultLanguage,
          host: (origin === ''
            ? ''
            : new URL(origin).host) as `${string}.${string}`,
        },
        openGraph: {
          description,
          imageAlt: get(config.socialImage.alt, ''),
          imageHeight: get(config.socialImage.height, 630),
          imageUrl: get(config.socialImage.url, '' as HTTPSUrl),
          imageWidth: get(config.socialImage.width, 1200),
          locale: get(config.openGraphLocale, '' as OpenGraphLocale),
          siteName: applicationName,
          title,
          url: pageUrl,
        },
        twitter: {
          creator: get(config.twitter.creator, '' as `@${string}`),
          description,
          imageAlt: get(config.socialImage.alt, ''),
          imageUrl: get(config.socialImage.url, '' as HTTPSUrl),
          site: get(config.twitter.site, '' as `@${string}`),
          title,
          url: pageUrl,
        },
      },
      themeColor,
      title,
    },
    manifest: {
      backgroundColor: get(config.backgroundColor, themeColor),
      categories: get(config.manifest?.categories, []),
      description,
      display: get(config.manifest?.display, 'standalone'),
      icon192: icon192 as URLPath,
      icon512: icon512 as URLPath,
      id: get(config.manifest?.id, '/' as URLPath),
      lang: language,
      maskableIcon512: get(config.icons.maskableIcon512, icon512 as URLPath),
      name: applicationName,
      orientation: get(config.manifest?.orientation, 'any'),
      scope: get(config.manifest?.scope, '/' as URLPath),
      screenshots: get(config.manifest?.screenshots, []),
      shortName: get(config.shortName, applicationName),
      shortcuts: get(config.manifest?.shortcuts, []),
      startUrl: `/${language}`,
      themeColor,
    },
  }
}
