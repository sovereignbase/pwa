import type { BCP47LanguageTag, OpenGraphLocale } from '@sovereignbase/utils'

/** Absolute HTTPS URL. */
export type HTTPSUrl = `https://${string}`
/** Root-relative URL path. */
export type URLPath = `/${string}`

/** Values used to render a complete localized HTML document. */
export interface DocumentMarkupOptions {
  applicationName: string
  appleStatusBarStyle?: 'default' | 'black' | 'black-translucent'
  appleTouchIconUrl?: URLPath
  bodyMarkup: string
  colorScheme?: 'light' | 'dark' | 'light dark' | 'dark light'
  entrypoint?: string
  headMarkup?: string
  iconUrl?: URLPath
  language: BCP47LanguageTag
  manifestUrl?: URLPath
  maskIconColor?: string
  maskIconUrl?: URLPath
  seo: DocumentSEO
  stylesheet?: string
  themeColor: string
  title: string
}

/** Search and social metadata for a localized document. */
export interface DocumentSEO {
  jsonLD: JSONLDMarkup
  languageLinks: LanguageLinksMarkupOptions
  openGraph: OpenGraphMarkupOptions
  twitter: TwitterMarkupOptions
}

/** Schema.org graph values for a site, application, page, and organization. */
export interface JSONLDMarkup {
  application: {
    applicationCategory?: string
    browserRequirements?: string
    featureList?: string[]
    inLanguage: BCP47LanguageTag[]
    name: string
    operatingSystem?: string
    screenshot?: HTTPSUrl[]
    url: HTTPSUrl
  }
  organization: {
    logo: HTTPSUrl
    name: string
    url: HTTPSUrl
  }
  page: {
    description: string
    inLanguage: BCP47LanguageTag
    name: string
    url: HTTPSUrl
  }
  site: {
    name: string
    url: HTTPSUrl
  }
}

/** Canonical and alternate-language link values. */
export interface LanguageLinksMarkupOptions {
  alternateLanguages: BCP47LanguageTag[]
  canonicalLanguage: BCP47LanguageTag
  defaultLanguage: BCP47LanguageTag
  host: `${string}.${string}`
  pathSuffix?: '' | `/${string}`
}

/** Open Graph metadata values. */
export interface OpenGraphMarkupOptions {
  description: string
  imageAlt: string
  imageHeight?: number
  imageUrl: string
  imageWidth?: number
  locale: OpenGraphLocale
  siteName: string
  title: string
  url: HTTPSUrl
}

/** Twitter Card metadata values. */
export interface TwitterMarkupOptions {
  creator: `@${string}`
  description: string
  imageAlt: string
  imageUrl: string
  site: `@${string}`
  title: string
  url: HTTPSUrl
}
