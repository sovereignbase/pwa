import { expect, test } from '@playwright/test'

test('generates a localized, indexed installer with complete SEO', async ({
  request,
}) => {
  const response = await request.get('/fi/')
  expect(response.ok()).toBe(true)
  const markup = await response.text()

  expect(markup.split(/\r?\n/)).toHaveLength(1)
  expect(markup).toContain('<html lang=fi>')
  expect(markup).toContain('navigator.serviceWorker.register')
  expect(markup).toContain('application/ld+json')
  expect(markup).toContain('property=og:title')
  expect(markup).toContain('name=twitter:card')
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

  await context.setOffline(true)
  await page.reload()
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      document.documentElement.dataset.ready === 'true'
  )
  await expect(page.locator('h1')).toHaveText('Offline-first-esimerkki')
  await context.setOffline(false)
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
