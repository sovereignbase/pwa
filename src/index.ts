import { existsSync, type PathLike } from 'node:fs'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { BCP47LanguageTag, OpenGraphLocale } from '@sovereignbase/utils'
import type { DocumentMarkupOptions, HTTPSUrl, URLPath } from './types/index.js'
import { baseSecurityHeaders } from './baseSecurityHeaders/index.js'
import { buildScriptDirectory } from './buildScriptDirectory/index.js'
import { contentBuildId } from './contentBuildId/index.js'
import { contentSecurityPolicy } from './contentSecurityPolicy/index.js'
import type { ContentSecurityPolicySources } from './contentSecurityPolicy/index.js'
import {
  buildAndroidDistribution,
  type DistributionOptions,
} from './distribution/android/index.js'
import { functionExpression } from './functionExpression/index.js'
import { globRule } from './globRule/index.js'
import { headersMarkup } from './headersMarkup/index.js'
import { documentMarkup } from './htmlDocument/index.js'
import { localizeConfig } from './localizeConfig/index.js'
import minifyCss from './minifyCss/index.js'
import minifyHtml from './minifyHtml/index.js'
import minifyJs from './minifyJs/index.js'
import { publicFiles } from './publicFiles/index.js'
import { securityHeaders } from './securityHeaders/index.js'
import {
  webManifest,
  type WebManifestOptions,
  type WebManifestScreenshot,
  type WebManifestShortcut,
} from './webManifest/index.js'

export type {
  AndroidDistributionOptions,
  DistributionOptions,
} from './distribution/android/index.js'
export type {
  ContentSecurityPolicyDirective,
  ContentSecurityPolicySources,
} from './contentSecurityPolicy/index.js'

/**
 * Builds a localized, offline-first PWA into `<outDir>/web`.
 *
 * The build emits indexed installer documents, localized web manifests,
 * bundled language modules, copied assets, deployment headers, a deterministic
 * build ID, and a self-rendering Service Worker.
 *
 * @param config Complete build, localization, metadata, and worker settings.
 */
export async function pwaize(config: PWAizeConfig): Promise<void> {
  const outputDirectory = join(config.outDir.toString(), 'web')
  const languages = [
    ...new Set([config.defaultLanguage, ...config.alternateLanguages]),
  ]
  const minifyPasses = 3
  const buildIdUrl = '/.sovereignbase/pwa/pwaize-build-id.txt'
  const serviceWorkerPath = '/ServiceWorker'

  await mkdir(outputDirectory, { recursive: true })

  if (config.assetsDir !== undefined) {
    const sourceDirectory = config.assetsDir.toString()
    await cp(
      sourceDirectory,
      join(outputDirectory, basename(sourceDirectory)),
      { recursive: true }
    )
  }

  if (config.i18nDir !== undefined) {
    const sourceDirectory = config.i18nDir.toString()
    await buildScriptDirectory(
      sourceDirectory,
      join(outputDirectory, basename(sourceDirectory)),
      minifyPasses
    )
  }

  const stylesheet = await minifyCss(config.stylesheet)
  const entrypoint = await minifyJs(config.entrypoint, {
    passes: minifyPasses,
  })
  const installer = await minifyJs(
    {
      source: `const url=${JSON.stringify(serviceWorkerPath)};const policy=globalThis.trustedTypes?.createPolicy("pwaize",{createScriptURL:()=>url});await navigator.serviceWorker.register(policy?.createScriptURL(url)??url,{scope:"/",type:"module"});await navigator.serviceWorker.ready;location.reload();`,
    },
    { passes: minifyPasses }
  )
  const documentOptions: Record<
    string,
    Omit<
      DocumentMarkupOptions,
      'entrypoint' | 'language' | 'manifestUrl' | 'stylesheet'
    >
  > = {}
  const documentSecurityHeaders: Record<string, Record<string, string>> = {}
  const installerDocuments: string[] = []

  for (const language of languages) {
    const localized = localizeConfig(config, language, languages)
    const languageDirectory = join(outputDirectory, language)
    const manifestPath = `/${language}/manifest.webmanifest` as const
    const manifest = webManifest(localized.manifest)
    documentOptions[language] = localized.document

    await mkdir(languageDirectory, { recursive: true })
    await writeFile(join(languageDirectory, 'manifest.webmanifest'), manifest)

    const installerDocument = await minifyHtml(
      await documentMarkup({
        ...localized.document,
        entrypoint: installer,
        language,
        manifestUrl: manifestPath,
      })
    )
    const applicationDocument = await documentMarkup({
      ...localized.document,
      entrypoint,
      language,
      manifestUrl: manifestPath,
      stylesheet,
    })
    documentSecurityHeaders[language] = securityHeaders(
      await contentSecurityPolicy(
        [applicationDocument],
        config.contentSecurityPolicy
      )
    )
    installerDocuments.push(installerDocument)
    await writeFile(join(languageDirectory, 'index.html'), installerDocument)

    if (language === config.defaultLanguage) {
      await writeFile(join(outputDirectory, 'index.html'), installerDocument)
      await writeFile(join(outputDirectory, 'manifest.webmanifest'), manifest)
    }
  }

  if (config._headersFile === true) {
    const installerContentSecurityPolicy = await contentSecurityPolicy(
      installerDocuments,
      config.contentSecurityPolicy
    )
    const installerRoutes = [
      '/',
      '/index.html',
      ...languages.flatMap((language) => [`/${language}`, `/${language}/*`]),
    ]
      .map(
        (route) =>
          `${route}\n${headersMarkup({ 'Content-Security-Policy': installerContentSecurityPolicy })}`
      )
      .join('\n')
    const assetsHeaders =
      config.assetsDir === undefined
        ? ''
        : `/${basename(config.assetsDir.toString())}/*\n  Cache-Control: public, max-age=31536000, immutable\n\n`
    await writeFile(
      join(outputDirectory, '_headers'),
      `/${serviceWorkerPath.slice(1)}\n  Cache-Control: no-cache\n  Content-Type: text/javascript;charset=UTF-8\n\n${buildIdUrl}\n  Cache-Control: no-cache, no-store, must-revalidate\n  Content-Type: text/plain;charset=UTF-8\n\n${assetsHeaders}${installerRoutes}\n/*\n${headersMarkup(baseSecurityHeaders())}`
    )
  }

  if (config.distribution?.android !== undefined) {
    await buildAndroidDistribution({
      android: config.distribution.android,
      defaultLanguage: config.defaultLanguage,
      distribution: config.distribution,
      origin: documentOptions[config.defaultLanguage].seo.jsonLD.site.url,
      outDirectory: config.outDir.toString(),
      webDirectory: outputDirectory,
    })
  }

  const generatedFiles = (await publicFiles(outputDirectory)).filter(
    (url) => url !== serviceWorkerPath && url !== buildIdUrl
  )
  const precache = [
    ...new Set([...generatedFiles, ...(config.serviceWorker?.precache ?? [])]),
  ]
    .filter((url) => {
      const pathname = new URL(url, 'https://pwaize.invalid').pathname
      return !pathname.endsWith('/index.html')
    })
    .sort()
  const staticRoutes = [
    ...new Set(
      precache.map((url) => new URL(url, 'https://pwaize.invalid').pathname)
    ),
  ].sort()
  const bypassRules = (config.serviceWorker?.bypass ?? []).map(globRule)
  const initialize =
    config.serviceWorker?.initialize === undefined
      ? 'undefined'
      : functionExpression(config.serviceWorker.initialize)
  const waitUntil =
    config.serviceWorker?.waitUntil === undefined
      ? 'undefined'
      : functionExpression(config.serviceWorker.waitUntil)
  const buildId = await contentBuildId(outputDirectory, generatedFiles, {
    bypassRules,
    documentSecurityHeaders,
    documentOptions,
    entrypoint,
    initialize,
    precache,
    staticRoutes,
    stylesheet,
    waitUntil,
  })
  const buildIdDirectory = join(outputDirectory, '.sovereignbase', 'pwa')
  await mkdir(buildIdDirectory, { recursive: true })
  await writeFile(join(buildIdDirectory, 'pwaize-build-id.txt'), buildId)
  const compiledServiceWorker = new URL(
    './serviceWorker/entrypoint.js',
    import.meta.url
  )
  const serviceWorker = await minifyJs(
    /* v8 ignore next -- the packaged .js path is exercised by runtime tests */
    existsSync(compiledServiceWorker)
      ? compiledServiceWorker
      : new URL('./serviceWorker/entrypoint.ts', import.meta.url),
    {
      banner: `const __pwaInitialize=${initialize},__pwaWaitUntil=${waitUntil};`,
      define: {
        buildId: JSON.stringify(buildId),
        buildIdUrl: JSON.stringify(buildIdUrl),
        bypassRules: JSON.stringify(bypassRules),
        customInitialize: '__pwaInitialize',
        customWaitUntil: '__pwaWaitUntil',
        defaultLanguage: JSON.stringify(config.defaultLanguage),
        documentSecurityHeaders: JSON.stringify(documentSecurityHeaders),
        documentOptions: JSON.stringify(documentOptions),
        entrypoint: JSON.stringify(entrypoint),
        precache: JSON.stringify(precache),
        staticRoutes: JSON.stringify(staticRoutes),
        stylesheet: JSON.stringify(stylesheet),
      },
      passes: minifyPasses,
    }
  )

  await writeFile(
    join(outputDirectory, serviceWorkerPath.slice(1)),
    serviceWorker
  )
}

/** A shared value or values selected by BCP 47 language tag. */
export type Localized<T> = T | Partial<Record<BCP47LanguageTag, T>>

/** Declarative input accepted by {@link pwaize}. */
export type PWAizeConfig = {
  _headersFile?: boolean
  alternateLanguages: BCP47LanguageTag[]
  application?: {
    browserRequirements?: Localized<string>
    category?: Localized<string>
    featureList?: Localized<string[]>
    operatingSystem?: Localized<string>
  }
  applicationName: Localized<string>
  appleStatusBarStyle?: Localized<'black' | 'black-translucent' | 'default'>
  assetsDir?: PathLike
  backgroundColor?: Localized<string>
  bodyMarkup?: Localized<string>
  canonicalLanguage: BCP47LanguageTag
  colorScheme?: Localized<'dark' | 'dark light' | 'light' | 'light dark'>
  contentSecurityPolicy?: ContentSecurityPolicySources
  defaultLanguage: BCP47LanguageTag
  description: Localized<string>
  distribution?: DistributionOptions
  entrypoint: PathLike
  headMarkup?: Localized<string>
  i18nDir?: PathLike
  icons: {
    appleTouchIconUrl?: Localized<URLPath>
    icon192: Localized<URLPath>
    icon512: Localized<URLPath>
    iconUrl?: Localized<URLPath>
    maskableIcon512: Localized<URLPath>
    maskIconUrl?: Localized<URLPath>
  }
  manifest?: {
    categories?: Localized<string[]>
    display?: Localized<'browser' | 'fullscreen' | 'minimal-ui' | 'standalone'>
    id?: Localized<URLPath>
    orientation?: Localized<WebManifestOptions['orientation']>
    scope?: Localized<URLPath>
    screenshots?: Localized<WebManifestScreenshot[]>
    shortcuts?: Localized<WebManifestShortcut[]>
  }
  openGraphLocale: Localized<OpenGraphLocale>
  organization?: {
    logoUrl?: Localized<HTTPSUrl>
    name?: Localized<string>
    url?: Localized<HTTPSUrl>
  }
  origin: Localized<HTTPSUrl>
  outDir: PathLike
  serviceWorker?: {
    bypass?: Array<string | RegExp>
    initialize?: () => void
    precache?: URLPath[]
    waitUntil?: () => Promise<void>
  }
  shortName?: Localized<string>
  socialImage: {
    alt: Localized<string>
    height?: Localized<number>
    url: Localized<HTTPSUrl>
    width?: Localized<number>
  }
  stylesheet: PathLike
  themeColor: Localized<string>
  title: Localized<string>
  twitter: {
    creator: Localized<`@${string}`>
    site: Localized<`@${string}`>
  }
}
