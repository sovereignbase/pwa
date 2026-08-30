import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pwaize } from '../../dist/index.js'

assert.equal(
  typeof createRequire(import.meta.url)('../../dist/index.cjs').pwaize,
  'function'
)

const root = await mkdtemp(join(tmpdir(), 'pwa-runtime-'))
const source = join(root, 'source')
const output = join(root, 'output')

try {
  await mkdir(join(source, 'assets'), { recursive: true })
  await mkdir(join(source, 'i18n'), { recursive: true })
  await writeFile(
    join(source, 'entrypoint.js'),
    'const language=document.documentElement.lang;const content=(await import(`/i18n/${language}.js`)).default;document.documentElement.dataset.runtime=content.status'
  )
  await writeFile(join(source, 'stylesheet.css'), 'body { margin: 0px; }')
  await writeFile(join(source, 'assets', 'asset.txt'), 'asset')
  await writeFile(
    join(source, 'i18n', 'en.ts'),
    'export default {status:"compatible"} as const'
  )

  await pwaize({
    defaultLanguage: 'en',
    canonicalLanguage: 'en',
    alternateLanguages: [],
    applicationName: 'Runtime compatibility',
    bodyMarkup: '<main>Runtime compatibility</main>',
    description: 'Runtime compatibility',
    icons: {
      icon192: '/logo.png',
      icon512: '/logo.png',
      maskableIcon512: '/logo.png',
    },
    openGraphLocale: 'en_US',
    origin: 'https://example.test',
    socialImage: {
      alt: 'Logo',
      url: 'https://example.test/logo.png',
    },
    themeColor: '#123456',
    title: 'Runtime compatibility',
    twitter: { creator: '@runtime', site: '@runtime' },
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
  assert.match(
    await readFile(join(output, 'web', 'i18n', 'en.js'), 'utf8'),
    /status:"compatible"/
  )

  console.log(`${process.versions.bun ? 'Bun' : 'Node'} runtime compatible`)
} finally {
  await rm(root, { force: true, recursive: true })
}
