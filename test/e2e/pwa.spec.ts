import { expect, test } from '@playwright/test'

test('generates a localized, indexed installer with complete SEO', async ({
  request,
}) => {
  const response = await request.get('/fi/')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-security-policy']).toContain(
    "script-src 'self' 'unsafe-inline' 'sha256-"
  )
  expect(response.headers()['strict-transport-security']).toContain(
    'max-age=63072000'
  )
  const markup = await response.text()

  expect(markup.split(/\r?\n/)).toHaveLength(1)
  expect(markup).toContain('<html lang=fi>')
  expect(markup).toContain('navigator.serviceWorker.register')
  expect(markup).toContain('application/ld+json')
  expect(markup).toContain('property=og:title')
  expect(markup).toContain('name=twitter:card')
  expect(markup).toContain('name=description')
  expect(markup).toContain('hreflang=fi')
  expect(markup).not.toContain('<style')

  const manifest = await request.get('/fi/manifest.webmanifest')
  expect(await manifest.json()).toMatchObject({
    lang: 'fi',
    start_url: '/fi',
  })
})

test('installs the Service Worker, renders the app, and works offline', async ({
  context,
  page,
}) => {
  const runtimeErrors: string[] = []
  context.on('serviceworker', (worker) => {
    worker.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text())
    })
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  await page.goto('/fi/')
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      document.documentElement.dataset.ready === 'true'
  )

  await expect(page.locator('h1')).toHaveText('Offline-first-esimerkki')
  await expect(page.locator('p')).toContainText('Generoitu Service Worker')
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute(
    'href',
    '/fi/manifest.webmanifest'
  )

  const onlineResponse = await page.reload()
  expect(onlineResponse?.headers()['content-security-policy']).toContain(
    "style-src 'self' 'unsafe-inline' 'sha256-"
  )
  expect(onlineResponse?.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'"
  )
  expect(onlineResponse?.headers()['cross-origin-opener-policy']).toBe(
    'same-origin'
  )
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      document.documentElement.dataset.ready === 'true'
  )

  await context.setOffline(true)
  expect(
    await page.evaluate(async () => {
      const response = await fetch('/not-precached.txt')
      return response.status
    })
  ).toBe(503)
  await page.reload()
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      document.documentElement.dataset.ready === 'true'
  )
  await expect(page.locator('h1')).toHaveText('Offline-first-esimerkki')
  await context.setOffline(false)
  expect(runtimeErrors).toEqual([])
})

test('lets bypass globs go directly to the network', async ({ page }) => {
  await page.goto('/en/')
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      document.documentElement.dataset.ready === 'true'
  )

  const values = await page.evaluate(async () => {
    const url = `/api/value?test=${crypto.randomUUID()}`
    const first = await fetch(url).then((response) => response.json())
    const second = await fetch(url).then((response) => response.json())
    return [first.value, second.value]
  })

  expect(values[1]).toBe(values[0] + 1)
})

test('serves build and asset URLs directly instead of application HTML', async ({
  page,
}) => {
  await page.goto('/en/')
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      document.documentElement.dataset.ready === 'true'
  )

  const response = await page.goto('/@sovereignbase/pwa/pwaize-build-id.txt')
  expect(response?.headers()['content-type']).toContain('text/plain')
  await expect(page.locator('body')).toHaveText(/^[0-9a-f]{64}$/)

  const asset = await page.goto('/assets/logo.svg')
  expect(asset?.headers()['content-type']).toContain('image/svg+xml')
  expect(await asset?.text()).toContain('<svg')
})
