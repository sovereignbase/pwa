import type { BCP47LanguageTag } from '@sovereignbase/utils'

type Path = `/${string}`
type ImageURL = Path | `https://${string}`

/** Screenshot metadata emitted into a web app manifest. */
export interface WebManifestScreenshot {
  src: ImageURL
  sizes: `${number}x${number}`
  type?: `image/${string}`
  form_factor?: 'narrow' | 'wide'
  label?: string
}

/** Application shortcut emitted into a web app manifest. */
export interface WebManifestShortcut {
  name: string
  url: Path
  description?: string
  icons?: {
    src: ImageURL
    sizes: `${number}x${number}` | 'any'
    type?: `image/${string}`
  }[]
}

/** Values used to generate one localized web app manifest. */
export interface WebManifestOptions {
  name: string
  shortName: string
  description: string
  startUrl: Path
  themeColor: string
  icon192: ImageURL
  icon512: ImageURL
  maskableIcon512: ImageURL
  id?: Path
  scope?: Path
  backgroundColor?: string
  lang?: BCP47LanguageTag
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
  orientation?:
    | 'any'
    | 'natural'
    | 'portrait'
    | 'portrait-primary'
    | 'portrait-secondary'
    | 'landscape'
    | 'landscape-primary'
    | 'landscape-secondary'
  categories?: string[]
  screenshots?: WebManifestScreenshot[]
  shortcuts?: WebManifestShortcut[]
}

/**
 * Generates a standards-based Web App Manifest JSON string.
 */
export const webManifest = ({
  name,
  shortName,
  description,
  startUrl,
  themeColor,
  icon192,
  icon512,
  maskableIcon512,
  id = '/',
  scope = '/',
  backgroundColor = themeColor,
  lang,
  display = 'standalone',
  orientation,
  categories,
  screenshots,
  shortcuts,
}: WebManifestOptions): string =>
  JSON.stringify({
    id,
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope,
    display,
    theme_color: themeColor,
    background_color: backgroundColor,
    ...(lang ? { lang } : {}),
    ...(orientation ? { orientation } : {}),
    ...(categories?.length ? { categories } : {}),
    ...(screenshots?.length ? { screenshots } : {}),
    ...(shortcuts?.length ? { shortcuts } : {}),
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: maskableIcon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  })
