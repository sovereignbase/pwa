import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { pwaize, type PWAizeConfig } from '../../src/index.js'

describe('pwaize', () => {
  let directory: string
  let project: string
  let output: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pwa-integration-'))
    project = join(directory, 'project')
    output = join(directory, 'output')
    await writeFileTree(project)
  })

  it('builds localized installers, manifests, assets, i18n, and Service Worker', async () => {
    const config = configuration(project, output)
    config._headersFile = true
    config.minifyPasses = 1
    config.assetsDir = join(project, 'assets')
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
    const root = await readFile(join(web, 'index.html'), 'utf8')
    const english = await readFile(join(web, 'en', 'index.html'), 'utf8')
    const finnish = await readFile(join(web, 'fi', 'index.html'), 'utf8')
    const worker = await readFile(join(web, 'ServiceWorker'), 'utf8')
    const buildId = await readFile(
      join(web, '@sovereignbase', 'pwa', 'pwaize-build-id.txt'),
      'utf8'
    )

    expect(root).toBe(english)
    expect(finnish).toContain('<html lang=fi>')
    expect(english.split(/\r?\n/)).toHaveLength(1)
    expect(english).toContain('navigator.serviceWorker.register')
    expect(english).not.toContain('background:#fff')
    expect(
      JSON.parse(await readFile(join(web, 'manifest.webmanifest'), 'utf8'))
    ).toMatchObject({ lang: 'en', start_url: '/en/' })
    expect(
      JSON.parse(
        await readFile(join(web, 'fi', 'manifest.webmanifest'), 'utf8')
      )
    ).toMatchObject({ lang: 'fi', start_url: '/fi/' })
    expect(
      await readFile(join(web, 'assets', 'nested', 'asset.txt'), 'utf8')
    ).toBe('asset')
    expect(await readFile(join(web, 'i18n', 'fi.json'), 'utf8')).toContain(
      'Hei'
    )
    expect(await readFile(join(web, '_headers'), 'utf8')).toContain(
      'Cache-Control: no-cache'
    )
    expect(buildId).toMatch(/^[0-9a-f-]{36}$/)
    expect(worker.split(/\r?\n/)).toHaveLength(1)
    expect(worker).toContain(buildId)
    expect(worker).toContain('registration.update')
    expect(worker).toContain('clients.claim')
    expect(worker).toContain('/extra-resource')
    expect(worker).toContain('/assets/nested/asset.txt')
    expect(worker).toContain('background:#fff')
    expect(worker).toContain('dataset.integration')
  })

  it('builds with defaults and without optional directories or headers', async () => {
    const config = configuration(project, output)
    config.alternateLanguages = []
    config.languages = { en: config.languages.en }

    await pwaize(config)

    expect(existsSync(join(output, 'web', '_headers'))).toBe(false)
    expect(existsSync(join(output, 'web', 'assets'))).toBe(false)
    expect(existsSync(join(output, 'web', 'fi'))).toBe(false)
    expect(
      await readFile(join(output, 'web', 'ServiceWorker'), 'utf8')
    ).toContain('/en/manifest.webmanifest')
  })

  it('rejects a missing localized configuration', async () => {
    const config = configuration(project, output)
    delete config.languages.fi

    await expect(pwaize(config)).rejects.toThrow(
      'Missing PWA configuration for language "fi"'
    )
  })
})

async function writeFileTree(project: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(project, 'assets', 'nested'), { recursive: true })
  await mkdir(join(project, 'i18n'), { recursive: true })
  await writeFile(
    join(project, 'entrypoint.js'),
    'const dead="remove";if(false)console.log(dead);document.documentElement.dataset.integration="ready"'
  )
  await writeFile(
    join(project, 'stylesheet.css'),
    'body { background: #ffffff; margin: 0px; }'
  )
  await writeFile(join(project, 'assets', 'nested', 'asset.txt'), 'asset')
  await writeFile(join(project, 'i18n', 'en.json'), '{"hello":"Hello"}')
  await writeFile(join(project, 'i18n', 'fi.json'), '{"hello":"Hei"}')
}

function configuration(project: string, outDir: string): PWAizeConfig {
  return {
    defaultLanguage: 'en',
    canonicalLanguage: 'en',
    alternateLanguages: ['fi'],
    languages: {
      en: localized('en', 'en_US', 'English'),
      fi: localized('fi', 'fi_FI', 'Suomi'),
    },
    stylesheet: join(project, 'stylesheet.css'),
    entrypoint: join(project, 'entrypoint.js'),
    outDir,
  }
}

function localized(
  code: 'en' | 'fi',
  locale: 'en_US' | 'fi_FI',
  title: string
): PWAizeConfig['languages'][string] {
  const url = `https://example.test/${code}` as const
  return {
    document: {
      title,
      applicationName: 'Integration',
      themeColor: '#123456',
      nonce: 'integration',
      bodyMarkup: `<main>${title}</main>`,
      seo: {
        jsonLD: {
          site: { name: 'Integration', url: 'https://example.test' as const },
          application: {
            name: 'Integration',
            url: 'https://example.test' as const,
            inLanguage: ['en', 'fi'],
          },
          page: {
            name: title,
            description: title,
            url,
            inLanguage: code,
          },
          organization: {
            name: 'Integration',
            url: 'https://example.test' as const,
            logo: 'https://example.test/logo.png' as const,
          },
        },
        languageLinks: {
          host: 'example.test' as const,
          defaultLanguage: 'en',
          canonicalLanguage: code,
          alternateLanguages: ['en', 'fi'],
        },
        openGraph: {
          locale,
          siteName: 'Integration',
          title,
          description: title,
          url,
          imageUrl: '/image.png',
          imageAlt: 'Image',
        },
        twitter: {
          title,
          description: title,
          url,
          imageUrl: '/image.png',
          imageAlt: 'Image',
          site: '@integration' as const,
          creator: '@integration' as const,
        },
      },
    },
    manifest: {
      name: title,
      shortName: title,
      description: title,
      startUrl: `/${code}/` as const,
      themeColor: '#123456',
      icon192: '/icon.png' as const,
      icon512: '/icon.png' as const,
      maskableIcon512: '/icon.png' as const,
    },
  }
}
