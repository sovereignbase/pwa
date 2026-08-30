import type { BCP47LanguageTag, OpenGraphLocale } from '@sovereignbase/utils'
export type URLPath = `/${string}`
export type HTTPSUrl = `https://${string}`

export interface DocumentMarkupOptions {
  /** Language of the document. */
  language: BCP47LanguageTag

  /** Document title. */
  title: string

  /** Application name used by installed/mobile browser UI. */
  applicationName: string

  /** Theme color used by supported browser chrome. */
  themeColor: string

  /** CSP nonce applied to inline styles and scripts. */
  nonce: string

  /** Complete markup rendered inside `<body>`. */
  bodyMarkup: string

  /** Additional markup inserted into `<head>`. */
  headMarkup?: string

  /** Critical CSS rendered inline during initial document load. */
  stylesheet?: string

  /** JavaScript module rendered inline into the document. */
  entrypoint?: string

  /** Favicon URL. */
  iconUrl?: URLPath

  /** Apple touch icon URL. */
  appleTouchIconUrl?: URLPath

  /** Safari pinned-tab mask icon URL. */
  maskIconUrl?: URLPath

  /** Web App Manifest URL. */
  manifestUrl?: URLPath

  /** Safari pinned-tab icon color. Defaults to `themeColor`. */
  maskIconColor?: string

  /** Preferred document color schemes. */
  colorScheme?: 'light' | 'dark' | 'light dark' | 'dark light'

  /** Apple standalone status bar appearance. */
  appleStatusBarStyle?: 'default' | 'black' | 'black-translucent'

  /** Search and social metadata rendered with the SEO component builders. */
  seo: DocumentSEO
}

export interface DocumentSEO {
  jsonLD: JSONLDMarkup
  languageLinks: LanguageLinksMarkupOptions
  openGraph: OpenGraphMarkupOptions
  twitter: TwitterMarkupOptions
}

export interface LanguageLinksMarkupOptions {
  host: `${string}.${string}`
  defaultLanguage: BCP47LanguageTag
  canonicalLanguage: BCP47LanguageTag
  alternateLanguages: BCP47LanguageTag[]
  pathSuffix?: '' | `/${string}`
}

export interface OpenGraphMarkupOptions {
  locale: OpenGraphLocale
  siteName: string
  title: string
  description: string
  url: HTTPSUrl
  imageUrl: string
  imageAlt: string
  imageWidth?: number
  imageHeight?: number
}

export interface TwitterMarkupOptions {
  title: string
  description: string
  url: HTTPSUrl
  imageUrl: string
  imageAlt: string
  site: `@${string}`
  creator: `@${string}`
}

export interface JSONLDMarkup {
  site: {
    name: string
    url: HTTPSUrl
  }

  application: {
    name: string
    url: HTTPSUrl
    inLanguage: BCP47LanguageTag[]
    applicationCategory?: string
    operatingSystem?: string
    browserRequirements?: string
    featureList?: string[]
    screenshot?: HTTPSUrl[]
  }

  page: {
    name: string
    description: string
    url: HTTPSUrl
    inLanguage: BCP47LanguageTag
  }

  organization: {
    name: string
    url: HTTPSUrl
    logo: HTTPSUrl
  }
}
