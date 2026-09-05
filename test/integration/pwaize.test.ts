import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pwaize, type PWAizeConfig } from '../../src/index.js'

const buildAndroidDistribution = vi.hoisted(() => vi.fn())

vi.mock('../../src/distribution/android/index.js', async (importOriginal) => ({
  ...(await importOriginal()),
  buildAndroidDistribution,
}))

describe('pwaize', () => {
  let output: string
  let project: string

  beforeEach(async () => {
    buildAndroidDistribution.mockClear()
    const directory = await mkdtemp(join(tmpdir(), 'pwa-integration-'))
    output = join(directory, 'output')
    project = join(directory, 'project')
    await writeProject(project)
  })

  it('builds localized installers, manifests, copied directories, and the worker', async () => {
    const config = configuration(project, output)
    config._headersFile = true
    config.assetsDir = join(project, 'assets')
    config.contentSecurityPolicy = {
      'connect-src': ['https://api.stripe.com', 'https://maps.googleapis.com'],
      'frame-src': ['https://checkout.stripe.com', 'https://*.js.stripe.com'],
      'img-src': ['https://*.stripe.com'],
      'script-src': ['https://js.stripe.com', 'https://maps.googleapis.com'],
    }
    config.i18nDir = join(project, 'i18n')
    config.serviceWorker = {
      bypass: [
        '/api/**',
        '/asset-?.js',
        '/literal.+(x)',
        'https://cdn.example/*',
        /tracker/iu,
      ],
      precache: ['/extra-resource'],
      initialize() {
        globalThis.addEventListener('unhandledrejection', () => undefined)
      },
      async waitUntil() {
        await Promise.resolve()
      },
    }

    await pwaize(config)

    const web = join(output, 'web')
    const english = await readFile(join(web, 'en', 'index.html'), 'utf8')
    const finnish = await readFile(join(web, 'fi', 'index.html'), 'utf8')
    const worker = await readFile(join(web, 'ServiceWorker'), 'utf8')
    const buildId = await readFile(
      join(web, '.sovereignbase', 'pwa', 'pwaize-build-id.txt'),
      'utf8'
    )

    expect(await readFile(join(web, 'index.html'), 'utf8')).toBe(english)
    expect(english.split(/\r?\n/)).toHaveLength(1)
    expect(english).toContain('navigator.serviceWorker.register')
    expect(english).not.toContain('background:#fff')
    expect(finnish).toContain('<html lang=fi>')
    expect(
      JSON.parse(await readFile(join(web, 'manifest.webmanifest'), 'utf8'))
    ).toMatchObject({ lang: 'en', start_url: '/en' })
    expect(
      JSON.parse(
        await readFile(join(web, 'fi', 'manifest.webmanifest'), 'utf8')
      )
    ).toMatchObject({ lang: 'fi', start_url: '/fi' })
    expect(
      await readFile(join(web, 'assets', 'nested', 'asset.txt'), 'utf8')
    ).toBe('asset')
    expect(await readFile(join(web, 'i18n', 'fi.js'), 'utf8')).toContain('Hei')
    expect(await readFile(join(web, 'i18n', 'metadata.json'), 'utf8')).toBe(
      '{"format":1}'
    )
    expect(existsSync(join(web, 'i18n', 'content.d.js'))).toBe(false)
    const headers = await readFile(join(web, '_headers'), 'utf8')
    expect(headers).toContain('Cache-Control: no-cache')
    expect(headers).toContain('/.sovereignbase/pwa/pwaize-build-id.txt')
    expect(headers).toContain('Content-Type: text/plain;charset=UTF-8')
    expect(headers).toContain('/assets/*')
    expect(headers).toContain(
      'Cache-Control: public, max-age=31536000, immutable'
    )
    expect(headers).toContain("script-src 'self' 'unsafe-inline' 'sha256-")
    expect(headers).toContain("script-src-elem 'self' 'unsafe-inline' 'sha256-")
    expect(headers).toContain("style-src 'self' 'unsafe-inline' 'sha256-")
    expect(headers).toContain("'strict-dynamic'")
    expect(headers).toContain("require-trusted-types-for 'script'")
    expect(headers).toContain(
      "connect-src 'self' https: wss: https://api.stripe.com https://maps.googleapis.com"
    )
    expect(headers).toContain(
      'frame-src https://checkout.stripe.com https://*.js.stripe.com'
    )
    expect(headers).toContain(
      "img-src 'self' data: https: https://*.stripe.com"
    )
    expect(headers).toContain(
      'https://js.stripe.com https://maps.googleapis.com'
    )
    expect(headers).toContain("script-src-elem 'self' 'unsafe-inline' 'sha256-")
    expect(headers).toContain(
      'https://js.stripe.com https://maps.googleapis.com; style-src'
    )
    expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin')
    expect(headers).toContain('Cross-Origin-Resource-Policy: same-origin')
    expect(headers).toContain('Strict-Transport-Security: max-age=63072000')
    expect(headers).toContain('X-Frame-Options: DENY')
    expect(headers.split('\n/*\n').at(-1)).not.toContain(
      'Content-Security-Policy'
    )
    expect(headers).toContain('\n/en/*\n  Content-Security-Policy:')
    expect(buildId).toMatch(/^[0-9a-f]{64}$/)
    expect(worker.split(/\r?\n/)).toHaveLength(1)
    expect(worker).toContain(buildId)
    expect(worker).toContain('/.sovereignbase/pwa/pwaize-build-id.txt')
    expect(worker).toContain('registration.update')
    expect(worker).toContain('clients.claim')
    expect(worker).toContain('/extra-resource')
    expect(worker).toContain('/assets/nested/asset.txt')
    expect(worker).toContain('/i18n/')
    expect(worker).toContain('background:#fff')
    expect(worker).toContain('dataset.integration')
    expect(worker).toContain('https://api.stripe.com')
    expect(worker).toContain('https://checkout.stripe.com')
  })

  it('builds with scalar defaults and without optional output', async () => {
    const config = configuration(project, output)
    config.alternateLanguages = []
    config.application = undefined
    config.backgroundColor = undefined
    config.bodyMarkup = undefined
    config.colorScheme = undefined
    config.headMarkup = undefined
    config.manifest = undefined
    config.organization = undefined
    config.shortName = undefined
    config.socialImage.height = undefined
    config.socialImage.width = undefined

    await pwaize(config)

    expect(existsSync(join(output, 'web', '_headers'))).toBe(false)
    expect(existsSync(join(output, 'web', 'assets'))).toBe(false)
    expect(existsSync(join(output, 'web', 'fi'))).toBe(false)
    expect(existsSync(join(output, 'android'))).toBe(false)
    expect(buildAndroidDistribution).not.toHaveBeenCalled()
    expect(
      await readFile(join(output, 'web', 'ServiceWorker'), 'utf8')
    ).toContain('/en/manifest.webmanifest')
  })

  it('builds Android only when its distribution feature is configured', async () => {
    const config = configuration(project, output)
    config.distribution = {
      android: {},
      build: 1,
      id: 'dev.example.pwa',
      version: '1.0.0',
    }

    await pwaize(config)

    expect(buildAndroidDistribution).toHaveBeenCalledOnce()
    expect(buildAndroidDistribution).toHaveBeenCalledWith(
      expect.objectContaining({
        android: {},
        defaultLanguage: 'en',
        origin: 'https://example.test',
        outDirectory: output,
        webDirectory: join(output, 'web'),
      })
    )
  })

  it('falls back from requested language to default language and then empty', async () => {
    const config = configuration(project, output)
    config.applicationName = { en: 'Default name' }
    config.description = {}
    config.origin = {}
    config.title = { en: 'Default title', fi: 'Suomenkielinen otsikko' }

    await pwaize(config)

    const manifest = JSON.parse(
      await readFile(join(output, 'web', 'fi', 'manifest.webmanifest'), 'utf8')
    )
    expect(manifest).toMatchObject({ description: '', name: 'Default name' })
    expect(
      await readFile(join(output, 'web', 'fi', 'index.html'), 'utf8')
    ).toContain('<title>Suomenkielinen otsikko</title>')
  })

  it('supports arrow hooks and an empty localized icon', async () => {
    const config = configuration(project, output)
    config._headersFile = true
    config.icons.icon512 = {}
    config.serviceWorker = { initialize: () => undefined }

    await pwaize(config)

    const worker = await readFile(join(output, 'web', 'ServiceWorker'), 'utf8')
    expect(worker).toContain('void 0')
    expect(
      await readFile(join(output, 'web', '_headers'), 'utf8')
    ).not.toContain('max-age=31536000')
  })

  it('keeps the build ID stable until build content changes', async () => {
    const config = configuration(project, output)
    const buildIdPath = join(
      output,
      'web',
      '.sovereignbase',
      'pwa',
      'pwaize-build-id.txt'
    )

    await pwaize(config)
    const first = await readFile(buildIdPath, 'utf8')
    await pwaize(config)
    expect(await readFile(buildIdPath, 'utf8')).toBe(first)

    await writeFile(
      join(project, 'entrypoint.js'),
      'document.documentElement.dataset.integration="changed"'
    )
    await pwaize(config)
    expect(await readFile(buildIdPath, 'utf8')).not.toBe(first)
  })
})

async function writeProject(project: string): Promise<void> {
  await mkdir(join(project, 'assets', 'nested'), { recursive: true })
  await mkdir(join(project, 'i18n', 'shared'), { recursive: true })
  await writeFile(
    join(project, 'entrypoint.js'),
    'const language=document.documentElement.lang;const content=(await import(`/i18n/${language}.js`)).default;document.documentElement.dataset.integration=content.hello'
  )
  await writeFile(
    join(project, 'stylesheet.css'),
    'body { background: #ffffff; margin: 0px; }'
  )
  await writeFile(join(project, 'assets', 'nested', 'asset.txt'), 'asset')
  await writeFile(
    join(project, 'i18n', 'en.ts'),
    'import{hello}from"./shared/hello.ts";export default {hello} as const'
  )
  await writeFile(
    join(project, 'i18n', 'fi.ts'),
    'export default {hello:"Hei"} as const'
  )
  await writeFile(
    join(project, 'i18n', 'content.d.ts'),
    'declare const content: {readonly hello: string}; export default content'
  )
  await writeFile(join(project, 'i18n', 'metadata.json'), '{"format":1}')
  await writeFile(
    join(project, 'i18n', 'shared', 'hello.ts'),
    'export const hello="Hello" as const'
  )
}

function configuration(project: string, outDir: string): PWAizeConfig {
  return {
    alternateLanguages: ['fi'],
    application: {
      browserRequirements: 'Modern browser',
      category: 'BusinessApplication',
      featureList: ['Offline'],
      operatingSystem: 'Any',
    },
    applicationName: { en: 'Integration' },
    backgroundColor: '#ffffff',
    bodyMarkup: { en: '<main>English</main>', fi: '<main>Suomi</main>' },
    canonicalLanguage: 'en',
    colorScheme: 'light',
    defaultLanguage: 'en',
    description: { en: 'English', fi: 'Suomi' },
    entrypoint: join(project, 'entrypoint.js'),
    headMarkup: '<meta name="integration" content="true">',
    icons: {
      appleTouchIconUrl: '/apple.png',
      icon192: '/icon.png',
      icon512: '/icon.png',
      iconUrl: '/favicon.png',
      maskableIcon512: '/maskable.png',
      maskIconUrl: '/mask.svg',
    },
    manifest: {
      categories: ['business'],
      display: 'standalone',
      id: '/app',
      orientation: 'portrait',
      scope: '/',
      screenshots: [{ src: '/shot.png', sizes: '1280x720' }],
      shortcuts: [{ name: 'Home', url: '/' }],
    },
    openGraphLocale: { en: 'en_US', fi: 'fi_FI' },
    organization: {
      logoUrl: 'https://example.test/logo.png',
      name: 'Organization',
      url: 'https://example.test',
    },
    origin: 'https://example.test',
    outDir,
    shortName: 'Integration',
    socialImage: {
      alt: { en: 'Image', fi: 'Kuva' },
      height: 320,
      url: 'https://example.test/image.png',
      width: 640,
    },
    stylesheet: join(project, 'stylesheet.css'),
    themeColor: '#123456',
    title: { en: 'English', fi: 'Suomi' },
    twitter: { creator: '@integration', site: '@integration' },
  }
}
