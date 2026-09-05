import { describe, expect, it } from 'vitest'
import { cspHash } from '../../src/cspHash/index.js'
import { contentSecurityPolicy } from '../../src/contentSecurityPolicy/index.js'
import { documentMarkup } from '../../src/htmlDocument/index.js'
import {
  jsonLDMarkup,
  languageLinksMarkup,
  ogMarkup,
  twitterMarkup,
} from '../../src/seoComponents/index.js'
import { webManifest } from '../../src/webManifest/index.js'
import type { DocumentSEO, JSONLDMarkup } from '../../src/types/index.js'

const jsonLD: JSONLDMarkup = {
  site: { name: 'Example', url: 'https://example.test' },
  application: {
    name: 'Example',
    url: 'https://example.test/app',
    inLanguage: ['en', 'fi'],
  },
  page: {
    name: 'Page',
    description: 'Description',
    url: 'https://example.test/en',
    inLanguage: 'en',
  },
  organization: {
    name: 'Organization',
    url: 'https://example.test',
    logo: 'https://example.test/logo.png',
  },
}

const seo: DocumentSEO = {
  jsonLD,
  languageLinks: {
    host: 'example.test',
    defaultLanguage: 'en',
    canonicalLanguage: 'en',
    alternateLanguages: ['en', 'fi'],
  },
  openGraph: {
    locale: 'en_US',
    siteName: 'Example',
    title: 'Page',
    description: 'Description',
    url: 'https://example.test/en',
    imageUrl: '/image.png',
    imageAlt: 'Image',
  },
  twitter: {
    title: 'Page',
    description: 'Description',
    url: 'https://example.test/en',
    imageUrl: '/image.png',
    imageAlt: 'Image',
    site: '@example',
    creator: '@author',
  },
}

describe('markup builders', () => {
  it('computes a CSP SHA-256 hash', async () => {
    await expect(cspHash('hello')).resolves.toBe(
      'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
    )
  })

  it('extends CSP source directives and removes a conflicting none source', async () => {
    const policy = await contentSecurityPolicy([], {
      'connect-src': ['https://api.example.test', 'https://api.example.test'],
      'frame-ancestors': ['https://admin.example.test'],
      'frame-src': ['https://checkout.example.test'],
      'script-src': ['https://js.example.test'],
      'script-src-elem': ['https://elements.example.test'],
    })

    expect(policy).toContain(
      "connect-src 'self' https: wss: https://api.example.test"
    )
    expect(policy).toContain('frame-ancestors https://admin.example.test')
    expect(policy).toContain('frame-src https://checkout.example.test')
    expect(policy).toMatch(
      /script-src-elem [^;]*https:\/\/js\.example\.test https:\/\/elements\.example\.test/
    )
    expect(policy).not.toContain("frame-ancestors 'none'")
  })

  it('renders compact JSON-LD with optional application metadata', () => {
    const markup = jsonLDMarkup({
      ...jsonLD,
      application: {
        ...jsonLD.application,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        browserRequirements: 'JavaScript',
        featureList: ['Offline'],
        screenshot: ['https://example.test/screenshot.png'],
      },
      page: { ...jsonLD.page, name: '<Page>' },
    })

    expect(markup).toContain('BusinessApplication')
    expect(markup).toContain('\\u003cPage>')
    expect(markup).not.toContain('\n  "@context"')

    const minimal = jsonLDMarkup(jsonLD)
    expect(minimal).not.toContain('applicationCategory')
    expect(
      JSON.parse(minimal.match(/<script[^>]*>(.*)<\/script>/s)![1])
    ).toMatchObject({ '@context': 'https://schema.org' })
  })

  it('renders canonical and alternate language links', () => {
    expect(
      languageLinksMarkup('example.test', 'en', 'fi', ['en', 'fi'], '/about')
    ).toContain('https://example.test/fi/about')
    expect(languageLinksMarkup('example.test', 'en', 'en', [])).toContain(
      'hreflang="x-default"'
    )
  })

  it('renders Open Graph and Twitter cards', () => {
    expect(
      ogMarkup(
        'en_US',
        'Example',
        'Title',
        'Description',
        'https://example.test',
        '/image.png',
        'Image'
      )
    ).toContain('content="1200"')
    expect(
      ogMarkup(
        'fi_FI',
        'Example',
        'Title',
        'Description',
        'https://example.test',
        '/image.png',
        'Image',
        640,
        320
      )
    ).toContain('content="640"')
    expect(
      twitterMarkup(
        'Title',
        'Description',
        'https://example.test',
        '/image.png',
        'Image',
        '@example',
        '@author'
      )
    ).toContain('summary_large_image')
  })

  it('renders complete and minimal dense HTML documents', async () => {
    const complete = await documentMarkup({
      language: 'en',
      title: 'Title',
      applicationName: 'Example',
      themeColor: '#123456',
      bodyMarkup: '<main>Body</main>',
      headMarkup: '<meta name="custom" content="yes">',
      stylesheet: 'body{color:red}',
      entrypoint: 'document.body.dataset.ready="true"',
      iconUrl: '/icon.svg',
      appleTouchIconUrl: '/apple.png',
      maskIconUrl: '/mask.svg',
      manifestUrl: '/manifest.webmanifest',
      maskIconColor: '#654321',
      colorScheme: 'dark',
      appleStatusBarStyle: 'black',
      seo,
    })

    expect(complete).not.toContain('>\n<')
    expect(complete).toContain('<style>')
    expect(complete).toContain('<script type="module">')
    expect(complete).toContain(
      '<meta name="description" content="Description" />'
    )
    expect(complete).toContain('rel="apple-touch-icon"')
    expect(complete).toContain('name="twitter:card"')

    const minimal = await documentMarkup({
      language: 'en',
      title: 'Title',
      applicationName: 'Example',
      themeColor: '#123456',
      bodyMarkup: '',
      seo,
    })
    expect(minimal).not.toContain('<style')
    expect(minimal).not.toContain('type="module"')
    expect(minimal).not.toContain('rel="icon"')
  })

  it('renders minimal and extended web manifests', () => {
    const required = {
      name: 'Example',
      shortName: 'App',
      description: 'Description',
      startUrl: '/en/' as const,
      themeColor: '#123456',
      icon192: '/icon-192.png' as const,
      icon512: '/icon-512.png' as const,
      maskableIcon512: '/maskable-512.png' as const,
    }
    const minimal = JSON.parse(webManifest(required))
    expect(minimal).toMatchObject({
      id: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#123456',
    })
    expect(minimal).not.toHaveProperty('lang')

    const extended = JSON.parse(
      webManifest({
        ...required,
        id: '/app',
        scope: '/app/',
        backgroundColor: '#ffffff',
        lang: 'en',
        display: 'fullscreen',
        orientation: 'portrait',
        categories: ['business'],
        screenshots: [
          { src: '/screenshot.png', sizes: '1280x720', form_factor: 'wide' },
        ],
        shortcuts: [{ name: 'Home', url: '/en/' }],
      })
    )
    expect(extended).toMatchObject({
      id: '/app',
      lang: 'en',
      orientation: 'portrait',
      categories: ['business'],
    })
  })
})
