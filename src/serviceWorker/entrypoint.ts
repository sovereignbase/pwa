declare const buildId: string
declare const bypassRules: ReadonlyArray<{
  absolute: boolean
  flags: string
  source: string
}>
declare const customInitialize: (() => void) | undefined
declare const customWaitUntil: (() => Promise<void>) | undefined
declare const defaultLanguage: string
declare const documents: Readonly<Record<string, string>>
declare const precache: readonly string[]

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
  if (event.request.method !== 'GET' || bypassesServiceWorker(event.request)) {
    return
  }

  const route =
    event.request.mode === 'navigate' ? routes.document : routes.static
  event.respondWith(route(event))
  event.waitUntil(backgroundStartup)
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
  event.waitUntil(
    Promise.all([deleteOldCaches(), worker.clients.claim(), backgroundStartup])
  )
})

worker.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    event.waitUntil(worker.skipWaiting())
  }
})

async function buildDocumentResponse(event: FetchEvent): Promise<Response> {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(event.request)
  const rendered = renderDocument(event.request).then(async (response) => {
    await cache.put(event.request, response.clone())
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

async function renderDocument(request: Request): Promise<Response> {
  const language = documentLanguage(request)
  return new Response(documents[language] ?? documents[defaultLanguage], {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'x-pwaize-build-id': buildId,
    },
  })
}

function documentLanguage(request: Request): string {
  const pathLanguage = new URL(request.url).pathname
    .split('/')
    .filter(Boolean)[0]
  if (pathLanguage in documents) return pathLanguage

  const accepted = request.headers.get('accept-language') ?? ''
  for (const preference of accepted.split(',')) {
    const language = preference.split(';')[0].trim()
    if (language in documents) return language

    const baseLanguage = language.split('-')[0]
    if (baseLanguage in documents) return baseLanguage
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

async function deleteOldCaches(): Promise<void> {
  const names = await caches.keys()
  await Promise.all(
    names
      .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name))
  )
}
