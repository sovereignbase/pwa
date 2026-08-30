import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pwaize } from '../dist/index.js'

const exampleDirectory = resolve('example')
const outputDirectory = resolve('example-build-result')

await rm(outputDirectory, { force: true, recursive: true })

const languages = {
  en: language('en', 'English', 'Offline-first example'),
  fi: language('fi', 'suomi', 'Offline-first-esimerkki'),
}

await pwaize({
  defaultLanguage: 'en',
  canonicalLanguage: 'en',
  alternateLanguages: ['fi'],
  languages,
  stylesheet: resolve(exampleDirectory, 'stylesheet.css'),
  entrypoint: resolve(exampleDirectory, 'entrypoint.js'),
  outDir: outputDirectory,
  assetsDir: resolve(exampleDirectory, 'assets'),
  i18nDir: resolve(exampleDirectory, 'i18n'),
  minifyPasses: 3,
  serviceWorker: {
    bypass: ['/api/**', 'https://example.test/external/**'],
  },
  _headersFile: true,
})

console.log(`Example built to ${outputDirectory}`)

function language(code, locale, title) {
  const url = `https://example.test/${code}`

  return {
    document: {
      title,
      applicationName: 'PWA example',
      themeColor: '#199473',
      nonce: 'example-build-nonce',
      bodyMarkup:
        '<main><img src="/assets/logo.svg" width="128" height="128" alt=""><h1>Installing…</h1><p>Please wait.</p></main>',
      iconUrl: '/assets/logo.svg',
      appleTouchIconUrl: '/assets/logo.svg',
      maskIconUrl: '/assets/logo.svg',
      seo: {
        jsonLD: {
          site: {
            name: 'PWA example',
            url: 'https://example.test',
          },
          application: {
            name: 'PWA example',
            url: 'https://example.test',
            inLanguage: ['en', 'fi'],
          },
          page: {
            name: title,
            description: title,
            url,
            inLanguage: code,
          },
          organization: {
            name: 'Sovereignbase',
            url: 'https://example.test',
            logo: 'https://example.test/assets/logo.svg',
          },
        },
        languageLinks: {
          host: 'example.test',
          defaultLanguage: 'en',
          canonicalLanguage: code,
          alternateLanguages: ['en', 'fi'],
        },
        openGraph: {
          locale: code === 'fi' ? 'fi_FI' : 'en_US',
          siteName: 'PWA example',
          title,
          description: title,
          url,
          imageUrl: 'https://example.test/assets/logo.svg',
          imageAlt: 'PWA example logo',
        },
        twitter: {
          title,
          description: title,
          url,
          imageUrl: 'https://example.test/assets/logo.svg',
          imageAlt: 'PWA example logo',
          site: '@sovereignbase',
          creator: '@sovereignbase',
        },
      },
    },
    manifest: {
      name: title,
      shortName: 'PWA example',
      description: title,
      startUrl: `/${code}/`,
      themeColor: '#199473',
      icon192: '/assets/logo.svg',
      icon512: '/assets/logo.svg',
      maskableIcon512: '/assets/logo.svg',
    },
  }
}
