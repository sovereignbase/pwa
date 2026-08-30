import type { DocumentMarkupOptions } from '../.types/index.js'
import { documentMarkup } from '../htmlDocument/index.js'

declare const buildId: string
declare const buildIdUrl: string
declare const bypassRules: ReadonlyArray<{
  absolute: boolean
  flags: string
  source: string
}>
declare const customInitialize: (() => void) | undefined
declare const customWaitUntil: (() => Promise<void>) | undefined
declare const defaultLanguage: DocumentMarkupOptions['language']
declare const contentSecurityPolicies: Readonly<Record<string, string>>
declare const documentOptions: Readonly<
  Record<
    string,
    Omit<
      DocumentMarkupOptions,
      'entrypoint' | 'language' | 'manifestUrl' | 'stylesheet'
    >
  >
>
declare const entrypoint: string
declare const precache: readonly string[]
declare const staticRoutes: readonly string[]
declare const stylesheet: string

const worker = self as unknown as ServiceWorkerGlobalScope
const cachePrefix = '@sovereignbase/pwa:'
const cacheName = `${cachePrefix}${buildId}`
const backgroundStartup = Promise.resolve(customWaitUntil?.())

customInitialize?.()

const routes = Object.freeze({
  document: buildDocumentResponse,
  static: negotiateCache,
})

worker.addEventListener('fetch', (event) => {
  event.waitUntil(Promise.all([backgroundStartup, checkForUpdate()]))

  if (event.request.method !== 'GET' || bypassesServiceWorker(event.request)) {
    return
  }

  if (new URL(event.request.url).pathname === buildIdUrl) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }))
    return
  }

  const route =
    event.request.mode === 'navigate' &&
    !staticRoutes.includes(new URL(event.request.url).pathname)
      ? routes.document
      : routes.static
  event.respondWith(route(event))
})

worker.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(cacheName).then((cache) => cache.addAll(precache)),
      worker.skipWaiting(),
      backgroundStartup,
    ])
  )
})

worker.addEventListener('activate', (event) => {
  event.waitUntil(activateServiceWorker())
})

worker.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    event.waitUntil(worker.skipWaiting())
  }
})

async function buildDocumentResponse(event: FetchEvent): Promise<Response> {
  const language = documentLanguage(event.request)
  const cache = await caches.open(cacheName)
  const cacheKey = documentCacheKey(event.request, language)
  const cached = await cache.match(cacheKey)
  const rendered = renderDocument(language).then(async (response) => {
    await cache.put(cacheKey, response.clone())
    return response
  })

  if (cached === undefined) return rendered

  event.waitUntil(rendered)
  return cached
}

async function negotiateCache(event: FetchEvent): Promise<Response> {
  const cached = await caches.match(event.request)
  const updated = fetch(event.request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(cacheName)
      await cache.put(event.request, response.clone())
    }
    return response
  })

  if (cached === undefined) return updated

  event.waitUntil(updated)
  return cached
}

async function renderDocument(
  language: DocumentMarkupOptions['language']
): Promise<Response> {
  const options = documentOptions[language]
  const markup = await documentMarkup({
    ...options,
    entrypoint,
    language,
    manifestUrl: `/${language}/manifest.webmanifest`,
    stylesheet,
  })

  return new Response(markup, {
    headers: {
      'content-security-policy': contentSecurityPolicies[language],
      'content-type': 'text/html;charset=UTF-8',
      'x-pwaize-build-id': buildId,
    },
  })
}

function documentCacheKey(
  request: Request,
  language: DocumentMarkupOptions['language']
): Request {
  const url = new URL(request.url)
  url.searchParams.set('__pwaize_language', language)
  return new Request(url)
}

function documentLanguage(request: Request): DocumentMarkupOptions['language'] {
  const pathLanguage = new URL(request.url).pathname
    .split('/')
    .filter(Boolean)[0]
  if (pathLanguage in documentOptions) {
    return pathLanguage as DocumentMarkupOptions['language']
  }

  const accepted = request.headers.get('accept-language') ?? ''
  for (const preference of accepted.split(',')) {
    const language = preference.split(';')[0].trim()
    if (language in documentOptions) {
      return language as DocumentMarkupOptions['language']
    }

    const baseLanguage = language.split('-')[0]
    if (baseLanguage in documentOptions) {
      return baseLanguage as DocumentMarkupOptions['language']
    }
  }

  return defaultLanguage
}

function bypassesServiceWorker(request: Request): boolean {
  const url = new URL(request.url)

  for (const rule of bypassRules) {
    const value = rule.absolute ? url.href : `${url.pathname}${url.search}`
    if (new RegExp(rule.source, rule.flags).test(value)) return true
  }

  return false
}

async function checkForUpdate(): Promise<void> {
  try {
    const response = await fetch(buildIdUrl, { cache: 'no-store' })
    if (!response.ok || (await response.text()).trim() === buildId) return

    await worker.registration.update()
  } catch {
    // Offline version checks must not prevent offline responses.
  }
}

async function activateServiceWorker(): Promise<void> {
  await Promise.all([
    deleteOldCaches(),
    worker.clients.claim(),
    backgroundStartup,
  ])
}

async function deleteOldCaches(): Promise<void> {
  const names = await caches.keys()
  await Promise.all(
    names
      .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name))
  )
}
