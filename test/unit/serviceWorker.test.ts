import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate } from '../../src/checkForUpdate/index.js'

type Listener = (event: any) => void

const listeners: Record<string, Listener> = {}
const responses = new Map<string, Response>()
const cache = {
  addAll: vi.fn(async () => undefined),
  match: vi.fn(async (request: Request) => responses.get(request.url)?.clone()),
  put: vi.fn(async (request: Request, response: Response) => {
    responses.set(request.url, response)
  }),
}
const cachesMock = {
  open: vi.fn(async () => cache),
  match: vi.fn(async (request: Request) => responses.get(request.url)?.clone()),
  keys: vi.fn(async () => [
    '@sovereignbase/pwa:old',
    '@sovereignbase/pwa:build-1',
    'unrelated',
  ]),
  delete: vi.fn(async () => true),
}
const worker = {
  addEventListener: vi.fn((name: string, listener: Listener) => {
    listeners[name] = listener
  }),
  clients: {
    claim: vi.fn(async () => undefined),
  },
  registration: { update: vi.fn(async () => undefined) },
  skipWaiting: vi.fn(async () => undefined),
}
const initialize = vi.fn()
const startup = vi.fn(async () => undefined)
let initialized = false
let started = false
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  if (url === '/build-id') return new Response('build-1')
  return new Response(`network:${url}`)
})

describe('generated Service Worker behavior', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', worker)
    vi.stubGlobal('caches', cachesMock)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('buildId', 'build-1')
    vi.stubGlobal('buildIdUrl', '/build-id')
    vi.stubGlobal('bypassRules', [
      { absolute: false, flags: '', source: '^/api/.*$' },
      { absolute: true, flags: 'i', source: '^https://external\\.test/' },
    ])
    vi.stubGlobal('customInitialize', initialize)
    vi.stubGlobal('customWaitUntil', startup)
    vi.stubGlobal('documentSecurityHeaders', {
      en: {
        'Content-Security-Policy': "default-src 'self'; script-src 'sha256-en'",
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      fi: {
        'Content-Security-Policy': "default-src 'self'; script-src 'sha256-fi'",
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    })
    vi.stubGlobal('defaultLanguage', 'en')
    vi.stubGlobal('documentOptions', {
      en: documentOptions('en', 'en_US'),
      fi: documentOptions('fi', 'fi_FI'),
    })
    vi.stubGlobal('entrypoint', 'document.documentElement.dataset.ready="true"')
    vi.stubGlobal('precache', ['/index.html', '/asset.txt'])
    vi.stubGlobal('staticRoutes', ['/asset.txt'])
    vi.stubGlobal('stylesheet', 'body{margin:0}')
    await import('../../src/serviceWorker/entrypoint.js')
    initialized = initialize.mock.calls.length === 1
    started = startup.mock.calls.length === 1
  })

  beforeEach(() => {
    responses.clear()
    for (const mock of [
      cache.addAll,
      cache.match,
      cache.put,
      cachesMock.open,
      cachesMock.match,
      cachesMock.keys,
      cachesMock.delete,
      worker.clients.claim,
      worker.registration.update,
      worker.skipWaiting,
      fetchMock,
    ]) {
      mock.mockClear()
    }
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestURL(input)
      if (url === '/build-id') return new Response('build-1')
      return new Response(`network:${url}`)
    })
  })

  it('initializes and registers all lifecycle listeners', () => {
    expect(initialized).toBe(true)
    expect(started).toBe(true)
    expect(Object.keys(listeners).sort()).toEqual([
      'activate',
      'fetch',
      'install',
      'message',
    ])
  })

  it('precaches, activates, cleans old caches, and claims clients', async () => {
    const install = serviceWorkerEvent()
    listeners.install(install.event)
    await install.done()
    expect(cache.addAll).toHaveBeenCalledWith(['/index.html', '/asset.txt'])
    expect(worker.skipWaiting).toHaveBeenCalledOnce()

    const activate = serviceWorkerEvent()
    listeners.activate(activate.event)
    await activate.done()
    expect(cachesMock.delete).toHaveBeenCalledTimes(1)
    expect(cachesMock.delete).toHaveBeenCalledWith('@sovereignbase/pwa:old')
    expect(worker.clients.claim).toHaveBeenCalledOnce()
  })

  it('handles skip-waiting messages and ignores other messages', async () => {
    const ignored = serviceWorkerEvent({ data: 'OTHER' })
    listeners.message(ignored.event)
    await ignored.done()
    expect(worker.skipWaiting).not.toHaveBeenCalled()

    const accepted = serviceWorkerEvent({ data: 'SKIP_WAITING' })
    listeners.message(accepted.event)
    await accepted.done()
    expect(worker.skipWaiting).toHaveBeenCalledOnce()
  })

  it('renders localized navigations without caching documents', async () => {
    const finnish = fetchEvent('https://example.test/fi/', {
      mode: 'navigate',
    })
    listeners.fetch(finnish.event)
    const first = await finnish.response()
    await finnish.done()
    expect(await first.text()).toContain('<html lang="fi">')
    expect(first.headers.get('content-security-policy')).toContain(
      "'sha256-fi'"
    )
    expect(first.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    expect(first.headers.get('x-pwaize-build-id')).toBe('build-1')

    const rendered = fetchEvent('https://example.test/en/rendered', {
      mode: 'navigate',
    })
    listeners.fetch(rendered.event)
    expect(await (await rendered.response()).text()).toContain(
      '<html lang="en">'
    )
    await rendered.done()
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('checks the build ID after every rendered navigation only', async () => {
    const first = fetchEvent('https://example.test/en/', { mode: 'navigate' })
    listeners.fetch(first.event)
    await first.response()
    await first.done()

    const second = fetchEvent('https://example.test/fi/', { mode: 'navigate' })
    listeners.fetch(second.event)
    await second.response()
    await second.done()

    const staticResource = fetchEvent('https://example.test/asset.txt')
    listeners.fetch(staticResource.event)
    await staticResource.response()
    await staticResource.done()

    const directBuildId = fetchEvent('https://example.test/build-id', {
      mode: 'navigate',
    })
    listeners.fetch(directBuildId.event)
    await directBuildId.response()
    await directBuildId.done()

    expect(
      fetchMock.mock.calls.filter(([input]) => input === '/build-id')
    ).toHaveLength(2)
  })

  it('negotiates exact, base, and default Accept-Language values', async () => {
    const exact = fetchEvent('https://example.test/', {
      mode: 'navigate',
      language: 'fi,en;q=0.8',
    })
    listeners.fetch(exact.event)
    expect(await (await exact.response()).text()).toContain('<html lang="fi">')

    const base = fetchEvent('https://example.test/', {
      mode: 'navigate',
      language: 'fi-FI,en;q=0.8',
    })
    listeners.fetch(base.event)
    expect(await (await base.response()).text()).toContain('<html lang="fi">')

    const fallback = fetchEvent('https://example.test/', {
      mode: 'navigate',
      language: 'de-DE',
    })
    listeners.fetch(fallback.event)
    expect(await (await fallback.response()).text()).toContain(
      '<html lang="en">'
    )

    const noHeader = fetchEvent('https://example.test/', { mode: 'navigate' })
    listeners.fetch(noHeader.event)
    expect(await (await noHeader.response()).text()).toContain(
      '<html lang="en">'
    )

    await Promise.all([
      exact.done(),
      base.done(),
      fallback.done(),
      noHeader.done(),
    ])
  })

  it('uses network and stale-while-revalidate for static resources', async () => {
    const fresh = fetchEvent('https://example.test/fresh.txt')
    listeners.fetch(fresh.event)
    expect(await (await fresh.response()).text()).toBe(
      'network:https://example.test/fresh.txt'
    )
    await fresh.done()
    expect(cache.put).toHaveBeenCalled()

    responses.set('https://example.test/cached.txt', new Response('cached'))
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestURL(input)
      return url === '/build-id'
        ? new Response('build-1')
        : new Response('failure', { status: 500 })
    })
    const stale = fetchEvent('https://example.test/cached.txt')
    listeners.fetch(stale.event)
    expect(await (await stale.response()).text()).toBe('cached')
    await stale.done()

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const cachedOffline = fetchEvent('https://example.test/cached.txt')
    listeners.fetch(cachedOffline.event)
    expect(await (await cachedOffline.response()).text()).toBe('cached')
    await expect(cachedOffline.done()).resolves.toBeUndefined()

    const missingOffline = fetchEvent('https://example.test/missing.txt')
    listeners.fetch(missingOffline.event)
    expect((await missingOffline.response()).status).toBe(503)
    await expect(missingOffline.done()).resolves.toBeUndefined()
  })

  it('bypasses configured path, absolute URL, and non-GET requests', async () => {
    for (const request of [
      fetchEvent('https://example.test/api/value'),
      fetchEvent('https://external.test/value'),
      fetchEvent('https://example.test/resource', { method: 'POST' }),
    ]) {
      listeners.fetch(request.event)
      expect(request.hasResponse()).toBe(false)
      await request.done()
    }
  })

  it('serves a direct build-ID navigation from the network', async () => {
    const request = fetchEvent('https://example.test/build-id', {
      mode: 'navigate',
    })
    listeners.fetch(request.event)

    expect(await (await request.response()).text()).toBe(
      'network:https://example.test/build-id'
    )
    await request.done()
    expect(fetchMock).toHaveBeenCalledWith(request.request, {
      cache: 'no-store',
    })

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const offline = fetchEvent('https://example.test/build-id', {
      mode: 'navigate',
    })
    listeners.fetch(offline.event)
    expect((await offline.response()).status).toBe(503)
    await expect(offline.done()).resolves.toBeUndefined()
  })

  it('serves a directly navigated precached asset as a static file', async () => {
    responses.set('https://example.test/asset.txt', new Response('asset'))
    const request = fetchEvent('https://example.test/asset.txt', {
      mode: 'navigate',
    })
    listeners.fetch(request.event)

    expect(await (await request.response()).text()).toBe('asset')
    await request.done()
  })

  it('updates only when a build-ID check finds a newer build', async () => {
    fetchMock.mockResolvedValueOnce(new Response('build-2'))
    await checkForUpdate(
      worker as unknown as ServiceWorkerGlobalScope,
      '/build-id',
      'build-1'
    )
    expect(worker.registration.update).toHaveBeenCalledOnce()

    fetchMock.mockResolvedValueOnce(new Response('build-1'))
    await checkForUpdate(
      worker as unknown as ServiceWorkerGlobalScope,
      '/build-id',
      'build-1'
    )
    expect(fetchMock).toHaveBeenCalledWith('/build-id', { cache: 'no-store' })

    fetchMock.mockResolvedValueOnce(new Response('missing', { status: 404 }))
    await checkForUpdate(
      worker as unknown as ServiceWorkerGlobalScope,
      '/build-id',
      'build-1'
    )
    expect(worker.registration.update).toHaveBeenCalledOnce()

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await checkForUpdate(
      worker as unknown as ServiceWorkerGlobalScope,
      '/build-id',
      'build-1'
    )
    expect(worker.registration.update).toHaveBeenCalledOnce()
  })
})

function requestURL(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function serviceWorkerEvent(properties: Record<string, unknown> = {}) {
  const promises: Promise<unknown>[] = []
  return {
    event: {
      ...properties,
      waitUntil(promise: Promise<unknown>) {
        promises.push(Promise.resolve(promise))
      },
    },
    async done() {
      await Promise.all(promises)
    },
  }
}

function fetchEvent(
  url: string,
  options: { language?: string; method?: string; mode?: string } = {}
) {
  const base = serviceWorkerEvent()
  let response: Promise<Response> | undefined
  const headers = new Headers()
  if (options.language !== undefined) {
    headers.set('accept-language', options.language)
  }
  const request = {
    headers,
    method: options.method ?? 'GET',
    mode: options.mode ?? 'cors',
    url,
  }
  Object.assign(base.event, {
    request,
    respondWith(value: Promise<Response> | Response) {
      response = Promise.resolve(value)
    },
  })
  return {
    ...base,
    event: base.event,
    hasResponse: () => response !== undefined,
    request,
    response: () => {
      if (response === undefined) throw new Error('No response was provided')
      return response
    },
  }
}

function documentOptions(code: 'en' | 'fi', locale: 'en_US' | 'fi_FI') {
  const url = `https://example.test/${code}` as const
  return {
    title: code,
    applicationName: 'Worker',
    themeColor: '#123456',
    bodyMarkup: `<main>${code}</main>`,
    seo: {
      jsonLD: {
        site: { name: 'Worker', url: 'https://example.test' as const },
        application: {
          name: 'Worker',
          url: 'https://example.test' as const,
          inLanguage: ['en', 'fi'],
        },
        page: {
          name: code,
          description: code,
          url,
          inLanguage: code,
        },
        organization: {
          name: 'Worker',
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
        siteName: 'Worker',
        title: code,
        description: code,
        url,
        imageUrl: '/logo.png',
        imageAlt: 'Logo',
      },
      twitter: {
        title: code,
        description: code,
        url,
        imageUrl: '/logo.png',
        imageAlt: 'Logo',
        site: '@worker' as const,
        creator: '@worker' as const,
      },
    },
  }
}
