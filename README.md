[![npm version](https://img.shields.io/npm/v/@sovereignbase/pwa)](https://www.npmjs.com/package/@sovereignbase/pwa)
[![JSR](https://jsr.io/badges/@sovereignbase/pwa)](https://jsr.io/@sovereignbase/pwa)
[![CI](https://github.com/sovereignbase/pwa/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/pwa/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/pwa/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/pwa)
[![license](https://img.shields.io/npm/l/@sovereignbase/pwa)](LICENSE)

# pwa

Build tool for localized, offline-first, search-engine-optimized progressive
web applications.

## Compatibility

- Runtimes: Node.js and Bun.
- Input: TypeScript or JavaScript, CSS, assets, and typed language modules.
- Output: static installers, localized manifests, immutable assets, and a
  self-rendering Service Worker.
- Module format: ESM or CJS.
- Types: bundled `.d.ts`.

## Installation

```sh
npm install --save-dev @sovereignbase/pwa
# or
pnpm add --save-dev @sovereignbase/pwa
# or
yarn add --dev @sovereignbase/pwa
# or
bun add --dev @sovereignbase/pwa
```

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
  distribution: {
    android: {},
    build: 1,
    id: 'com.example.pwa',
    version: '1.0.0',
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

## API

### `pwaize(config)`

The package's only runtime export. It bundles, tree-shakes, repeatedly
minifies, and writes the complete site to `<outDir>/web`.

Values such as titles, descriptions, colors, icons, and metadata are declared
once. Localizable fields accept either one value or a language record. Lookup
order is the requested language, `defaultLanguage`, and finally the field's
empty or default value.

`serviceWorker.bypass` accepts regular expressions and glob strings. `*`
matches within one path segment, `**` crosses path segments, and an absolute
pattern matches the complete URL.

## Language modules

TypeScript and JavaScript files under `i18nDir` are individually bundled,
tree-shaken, and minified to `.js`. Relative imports are bundled, declaration
files are ignored, and other files are copied.

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

The non-literal import remains dynamic. Generated language modules are included
in the Service Worker precache.

## Android distribution

Android support is opt-in. When `distribution.android` is absent, Bubblewrap is
not loaded and no Android files are generated. An empty object enables a
deterministic Trusted Web Activity project at `<outDir>/android/project`:

```sh
npm install --save-dev @bubblewrap/core
```

```ts
distribution: {
  android: {
    package: 'com.example.pwa',
    sha256CertFingerprints: ['AA:BB:CC:...'],
  },
  build: 1,
  id: 'com.example.pwa',
  version: '1.0.0',
}
```

The generated default-language web manifest supplies the Android name, launch
URL, colors, display mode, and icons. Its public `origin` and icon URLs must be
reachable while Bubblewrap generates the project. Certificate fingerprints
also produce `web/.well-known/assetlinks.json`, which is included in the web
precache.

Set both `android.androidSdkPath` and `android.jdkPath` to additionally run the
Gradle release builds. Project generation, compilation, and signing are
separate steps. Without a keystore, the results are
`app-release-unsigned.apk` and `app-release-unsigned.aab`. To sign both files,
set `android.keystore`, optionally set `android.keyAlias`, and provide
`ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` in the build environment.
Passwords are never accepted in config or written to output. With Play App
Signing, this keystore should contain the replaceable upload key; Google keeps
the long-lived app signing key.

## Output

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

android/                       # only with distribution.android
├── project/                   # generated Bubblewrap project
├── app-release-unsigned.apk   # with Android SDK and JDK
└── app-release-unsigned.aab
```

The root installer and manifest use `defaultLanguage`. Each language also gets
an indexed installer and manifest. Installers contain only the Service Worker
loader. The Service Worker renders the application document with its localized
SEO metadata, bundled stylesheet, and bundled entrypoint.

## Behavior

- JavaScript is bundled and tree-shaken with esbuild, then repeatedly compressed
  and mangled with Terser.
- CSS is bundled with esbuild and minified with Lightning CSS.
- HTML and its inline content are emitted as dense strings.
- Every localized document includes a standard description meta tag together
  with canonical, `hreflang`, JSON-LD, Open Graph, and Twitter metadata.
- Generated and copied files are precached.
- Precached static URLs remain files when opened directly in the browser; only
  application routes use document rendering.
- Application documents are rendered on every navigation and are not stored in
  Cache Storage. Static resources use stale-while-revalidate caching.
- Activation deletes old build caches and claims clients.
- The worker checks a deterministic content build ID in the background after
  every application navigation and requests an update when deployed content has
  changed.
- Repeated builds reuse unchanged JavaScript, CSS, and HTML minification results.
- Generated `_headers` keeps the Service Worker and build ID uncached and gives
  the assets directory a one-year immutable browser cache.

## Security headers

Generated installers and Service Worker application responses include a
`Content-Security-Policy`. `script-src` and `style-src` contain SHA-256 hashes
calculated from the final inline content. They also contain `'unsafe-inline'`
as a CSP1 fallback; browsers implementing CSP2 or newer ignore that fallback
when a hash source is present. Modern browsers additionally receive
`strict-dynamic`, blocked inline script and style attributes, and required
Trusted Types for script sinks.

The policy also restricts base URLs, framing, forms, objects, workers, fonts,
media, images, and network connections. Generated `_headers` adds strong HSTS,
same-origin COOP and CORP, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, and a strict-origin referrer policy. The same
document security headers are attached to application responses generated by
the Service Worker.

## Example

- Application: [example/entrypoint.js](./example/entrypoint.js)
- Typed languages: [example/i18n/en.ts](./example/i18n/en.ts) and
  [example/i18n/fi.ts](./example/i18n/fi.ts)
- Build driver: [test/index.js](./test/index.js)

## Tests

- Unit and integration tests in Vitest with TypeScript.
- Browser behavior tests in Playwright with TypeScript.
- Runtime build tests in Node.js and Bun, including ESM and CJS package wiring.
- Coverage: 100% statements, branches, functions, and lines.

## License

Apache-2.0
