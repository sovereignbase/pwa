import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pwaize } from '../dist/index.js'

const exampleDirectory = resolve('example')
const outputDirectory = resolve(exampleDirectory, 'dist')

await rm(outputDirectory, { force: true, recursive: true })

await pwaize({
  _headersFile: true,
  alternateLanguages: ['fi'],
  application: {
    browserRequirements: 'Requires a modern web browser.',
    category: 'BusinessApplication',
    featureList: ['Offline-first', 'Localized', 'Installable'],
    operatingSystem: 'Any',
  },
  applicationName: 'PWA example',
  assetsDir: resolve(exampleDirectory, 'assets'),
  bodyMarkup:
    '<main><img src="/assets/logo.svg" width="128" height="128" alt=""><h1>Installing…</h1><p>Please wait.</p></main>',
  canonicalLanguage: 'en',
  defaultLanguage: 'en',
  description: {
    en: 'An offline-first PWA build example.',
    fi: 'Offline-first-PWA-build-esimerkki.',
  },
  entrypoint: resolve(exampleDirectory, 'entrypoint.js'),
  i18nDir: resolve(exampleDirectory, 'i18n'),
  icons: {
    appleTouchIconUrl: '/assets/logo.svg',
    icon192: '/assets/logo.svg',
    icon512: '/assets/logo.svg',
    iconUrl: '/assets/logo.svg',
    maskableIcon512: '/assets/logo.svg',
    maskIconUrl: '/assets/logo.svg',
  },
  minifyPasses: 3,
  openGraphLocale: { en: 'en_US', fi: 'fi_FI' },
  origin: 'https://example.test',
  outDir: outputDirectory,
  serviceWorker: {
    bypass: ['/api/**', 'https://example.test/external/**'],
  },
  socialImage: {
    alt: 'PWA example logo',
    url: 'https://example.test/assets/logo.svg',
  },
  stylesheet: resolve(exampleDirectory, 'stylesheet.css'),
  themeColor: '#199473',
  title: {
    en: 'Offline-first example',
    fi: 'Offline-first-esimerkki',
  },
  twitter: {
    creator: '@sovereignbase',
    site: '@sovereignbase',
  },
})

console.log(`Example built to ${outputDirectory}`)
