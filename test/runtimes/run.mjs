import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pwaize } from '../../dist/index.js'

const root = await mkdtemp(join(tmpdir(), 'pwa-runtime-'))
const source = join(root, 'source')
const output = join(root, 'output')

try {
  await mkdir(join(source, 'assets'), { recursive: true })
  await mkdir(join(source, 'i18n'), { recursive: true })
  await writeFile(
    join(source, 'entrypoint.js'),
    'document.documentElement.dataset.runtime="compatible"'
  )
  await writeFile(join(source, 'stylesheet.css'), 'body { margin: 0px; }')
  await writeFile(join(source, 'assets', 'asset.txt'), 'asset')
  await writeFile(join(source, 'i18n', 'en.json'), '{"hello":"Hello"}')

  await pwaize({
    defaultLanguage: 'en',
    canonicalLanguage: 'en',
    alternateLanguages: [],
    languages: { en: localizedEnglish() },
    stylesheet: join(source, 'stylesheet.css'),
    entrypoint: join(source, 'entrypoint.js'),
    outDir: output,
    assetsDir: join(source, 'assets'),
    i18nDir: join(source, 'i18n'),
    minifyPasses: 1,
  })

  const installer = await readFile(join(output, 'web', 'index.html'), 'utf8')
  const serviceWorker = await readFile(
    join(output, 'web', 'ServiceWorker'),
    'utf8'
  )
  assert.match(installer, /navigator\.serviceWorker\.register/)
  assert.match(serviceWorker, /dataset\.runtime/)
  assert.equal(installer.split(/\r?\n/).length, 1)
  assert.equal(serviceWorker.split(/\r?\n/).length, 1)
  assert.equal(
    await readFile(join(output, 'web', 'assets', 'asset.txt'), 'utf8'),
    'asset'
  )
  assert.equal(
    await readFile(join(output, 'web', 'i18n', 'en.json'), 'utf8'),
    '{"hello":"Hello"}'
  )

  console.log(`${process.versions.bun ? 'Bun' : 'Node'} runtime compatible`)
} finally {
  await rm(root, { force: true, recursive: true })
}

function localizedEnglish() {
  const url = 'https://example.test/en'
  return {
    document: {
      title: 'Runtime compatibility',
      applicationName: 'Runtime compatibility',
      themeColor: '#123456',
      nonce: 'runtime',
      bodyMarkup: '<main>Runtime compatibility</main>',
      seo: {
        jsonLD: {
          site: { name: 'Runtime', url: 'https://example.test' },
          application: {
            name: 'Runtime',
            url: 'https://example.test',
            inLanguage: ['en'],
          },
          page: {
            name: 'Runtime',
            description: 'Runtime',
            url,
            inLanguage: 'en',
          },
          organization: {
            name: 'Runtime',
            url: 'https://example.test',
            logo: 'https://example.test/logo.png',
          },
        },
        languageLinks: {
          host: 'example.test',
          defaultLanguage: 'en',
          canonicalLanguage: 'en',
          alternateLanguages: ['en'],
        },
        openGraph: {
          locale: 'en_US',
          siteName: 'Runtime',
          title: 'Runtime',
          description: 'Runtime',
          url,
          imageUrl: '/logo.png',
          imageAlt: 'Logo',
        },
        twitter: {
          title: 'Runtime',
          description: 'Runtime',
          url,
          imageUrl: '/logo.png',
          imageAlt: 'Logo',
          site: '@runtime',
          creator: '@runtime',
        },
      },
    },
    manifest: {
      name: 'Runtime',
      shortName: 'Runtime',
      description: 'Runtime',
      startUrl: '/en/',
      themeColor: '#123456',
      icon192: '/logo.png',
      icon512: '/logo.png',
      maskableIcon512: '/logo.png',
    },
  }
}
