# @sovereignbase/pwa

Build a TypeScript or JavaScript web project into a localized, offline-first and search-engine-optimized PWA. The package has one runtime export: `pwaize`.

## Install

```sh
npm install --save-dev @sovereignbase/pwa
```

Node.js 20 or newer and Bun are supported.

## Usage

```ts
import { pwaize } from '@sovereignbase/pwa'

await pwaize({
  _headersFile: true,
  alternateLanguages: ['fi'],
  applicationName: 'Example',
  assetsDir: './src/client/assets',
  canonicalLanguage: 'en',
  defaultLanguage: 'en',
  description: {
    en: 'An offline-first example.',
    fi: 'Offline-first-esimerkki.',
  },
  entrypoint: './src/client/index.ts',
  i18nDir: './src/client/i18n',
  icons: {
    icon192: '/assets/icon-192.png',
    icon512: '/assets/icon-512.png',
    maskableIcon512: '/assets/icon-maskable-512.png',
  },
  openGraphLocale: { en: 'en_US', fi: 'fi_FI' },
  origin: 'https://example.com',
  outDir: './dist',
  serviceWorker: {
    bypass: ['/api/**', 'https://cdn.example.com/private/**'],
  },
  socialImage: {
    alt: { en: 'Example', fi: 'Esimerkki' },
    url: 'https://example.com/assets/social.png',
  },
  stylesheet: './src/client/style.css',
  themeColor: '#000000',
  title: { en: 'Example', fi: 'Esimerkki' },
  twitter: { creator: '@example', site: '@example' },
})
```

Every semantic value is declared once. Any leaf value that may vary by language accepts either a scalar or a language record. Resolution is requested language, then `defaultLanguage`, then the field's empty/default value. A scalar or just the default-language value is therefore enough for shared content.

## Typed language modules

Files under `i18nDir` ending in TypeScript or JavaScript are individually bundled, tree-shaken and minified to `.js`. Relative imports inside those modules are bundled. Other files are copied, and declaration files are ignored.

```ts
// src/client/i18n/en.ts
export default {
  description: 'Available offline.',
  title: 'Example',
} as const
```

The application entrypoint can load the generated module dynamically:

```ts
const language = document.documentElement.lang
const content = (await import(`/i18n/${language}.js`)).default
document.querySelector('h1')!.textContent = content.title
```

The non-literal import remains dynamic in the application bundle. For example, `en.ts` becomes `/i18n/en.js` and is included in the Service Worker precache.

## Output

`pwaize` writes to `<outDir>/web`:

```text
web/
├── ServiceWorker
├── index.html
├── manifest.webmanifest
├── en/index.html
├── en/manifest.webmanifest
├── fi/index.html
├── fi/manifest.webmanifest
├── assets/...
├── i18n/*.js
└── @sovereignbase/pwa/pwaize-build-id.txt
```

The root installer and manifest belong to `defaultLanguage`. Each language also receives an indexed installer and manifest. Installer pages contain the inline Service Worker installer but not the application stylesheet or entrypoint. The Service Worker renders the actual localized HTML with the bundled application CSS and JavaScript.

The worker uses stale-while-revalidate caching, precaches generated and copied public files, claims clients on activation, deletes older build caches and checks the deterministic content build ID for updates. `serviceWorker.bypass` accepts regular expressions and glob strings: `*` stays within one URL path segment, `**` crosses segments, and absolute patterns match the complete URL.

Repeated builds in the same process reuse unchanged Terser, Lightning CSS and HTML minification results. Identical output keeps the same build ID; changing application, language, asset or worker content produces a new ID.

See [example/entrypoint.js](./example/entrypoint.js) for the sample application and [test/index.js](./test/index.js) for its build driver.

## Verification

```sh
npm test
```

The suite includes TypeScript checks, 100% Vitest coverage, Node and Bun runtime builds, and Playwright desktop/mobile Chromium behavior tests for installation, localization, offline navigation and Service Worker bypass rules.
