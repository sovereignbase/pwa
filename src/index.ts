import { createHash } from 'node:crypto'
import { existsSync, type PathLike } from 'node:fs'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import type { BCP47LanguageTag, OpenGraphLocale } from '@sovereignbase/utils'
import type {
  DocumentMarkupOptions,
  HTTPSUrl,
  URLPath,
} from './.types/index.js'
import { documentMarkup } from './htmlDocument/index.js'
import minifyCss from './minifyCss/index.js'
import minifyHtml from './minifyHtml/index.js'
import minifyJs from './minifyJs/index.js'
import {
  webManifest,
  type WebManifestOptions,
  type WebManifestScreenshot,
  type WebManifestShortcut,
} from './webManifest/index.js'

export async function pwaize(config: PWAizeConfig): Promise<void> {
  const outputDirectory = join(config.outDir.toString(), 'web')
  const languages = [
    ...new Set([config.defaultLanguage, ...config.alternateLanguages]),
  ]
  const minifyPasses = config.minifyPasses ?? 3
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
      source: `await navigator.serviceWorker.register(${JSON.stringify(serviceWorkerPath)},{scope:"/",type:"module"});await navigator.serviceWorker.ready;location.reload();`,
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
    await writeFile(join(languageDirectory, 'index.html'), installerDocument)

    if (language === config.defaultLanguage) {
      await writeFile(join(outputDirectory, 'index.html'), installerDocument)
      await writeFile(join(outputDirectory, 'manifest.webmanifest'), manifest)
    }
  }

  if (config._headersFile === true) {
    await writeFile(
      join(outputDirectory, '_headers'),
      `/${serviceWorkerPath.slice(1)}\n  Cache-Control: no-cache\n  Content-Type: text/javascript;charset=UTF-8\n\n/*\n  X-Content-Type-Options: nosniff\n`
    )
  }

  const buildIdUrl = '/@sovereignbase/pwa/pwaize-build-id.txt'
  const generatedFiles = (await publicFiles(outputDirectory)).filter(
    (url) => url !== serviceWorkerPath && url !== buildIdUrl
  )
  const precache = [
    ...new Set([...generatedFiles, ...(config.serviceWorker?.precache ?? [])]),
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
    documentOptions,
    entrypoint,
    initialize,
    precache,
    stylesheet,
    waitUntil,
  })
  const buildIdDirectory = join(outputDirectory, '@sovereignbase', 'pwa')
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
        documentOptions: JSON.stringify(documentOptions),
        entrypoint: JSON.stringify(entrypoint),
        precache: JSON.stringify(precache),
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

async function buildScriptDirectory(
  sourceDirectory: string,
  outputDirectory: string,
  passes: number,
  root = sourceDirectory
): Promise<void> {
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const source = join(sourceDirectory, entry.name)
    if (entry.isDirectory()) {
      await buildScriptDirectory(source, outputDirectory, passes, root)
      continue
    }
    if (!entry.isFile() || entry.name.endsWith('.d.ts')) continue

    const relativePath = relative(root, source)
    const extension = extname(relativePath)
    const output = join(
      outputDirectory,
      /\.[cm]?[jt]sx?$/.test(extension)
        ? `${relativePath.slice(0, -extension.length)}.js`
        : relativePath
    )
    await mkdir(dirname(output), { recursive: true })
    if (/\.[cm]?[jt]sx?$/.test(extension)) {
      await writeFile(output, await minifyJs(source, { passes }))
    } else {
      await cp(source, output)
    }
  }
}

async function contentBuildId(
  outputDirectory: string,
  files: string[],
  configuration: unknown
): Promise<string> {
  const hash = createHash('sha256')
  hash.update(JSON.stringify(configuration))
  for (const file of files) {
    hash.update(file)
    hash.update(
      await readFile(join(outputDirectory, ...file.slice(1).split('/')))
    )
  }
  return hash.digest('hex')
}

async function publicFiles(
  directory: string,
  root = directory
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await publicFiles(path, root)))
    } else if (entry.isFile() && entry.name !== '_headers') {
      files.push(`/${relative(root, path).split(sep).join('/')}`)
    }
  }

  return files.sort()
}

function globRule(pattern: string | RegExp): {
  absolute: boolean
  flags: string
  source: string
} {
  if (pattern instanceof RegExp) {
    return { absolute: true, flags: pattern.flags, source: pattern.source }
  }

  let source = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*'
        index += 1
      } else {
        source += '[^/]*'
      }
    } else if (character === '?') {
      source += '.'
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }

  return {
    absolute: pattern.includes('://'),
    flags: '',
    source: `${source}$`,
  }
}

function functionExpression(
  callback: (...arguments_: never[]) => unknown
): string {
  const source = callback.toString()
  if (/^(?:async\s+)?function\b|^(?:async\s+)?\(/.test(source)) {
    return `(${source})`
  }
  if (source.startsWith('async ')) {
    return `(async function ${source.slice('async '.length)})`
  }
  return `(function ${source})`
}

function localizeConfig(
  config: PWAizeConfig,
  language: BCP47LanguageTag,
  languages: BCP47LanguageTag[]
): {
  document: Omit<
    DocumentMarkupOptions,
    'entrypoint' | 'language' | 'manifestUrl' | 'stylesheet'
  >
  manifest: WebManifestOptions
} {
  const get = <T>(value: Localized<T> | undefined, empty: T): T =>
    localizedValue(value, language, config.defaultLanguage, empty)
  const applicationName = get(config.applicationName, '')
  const description = get(config.description, '')
  const icon192 = get<string>(config.icons.icon192, '')
  const icon512 = get<string>(config.icons.icon512, '')
  const origin = get<string>(config.origin, '')
  const pageUrl = (
    origin === '' ? '' : new URL(`/${language}`, origin).href
  ) as HTTPSUrl
  const organizationLogo = (
    origin === '' || icon512 === '' ? '' : new URL(icon512, origin).href
  ) as HTTPSUrl
  const themeColor = get(config.themeColor, '')
  const title = get(config.title, '')

  return {
    document: {
      applicationName,
      appleStatusBarStyle: get(config.appleStatusBarStyle, 'black-translucent'),
      appleTouchIconUrl: get(
        config.icons.appleTouchIconUrl,
        icon192 as URLPath
      ),
      bodyMarkup: get(config.bodyMarkup, ''),
      colorScheme: get(config.colorScheme, 'light dark'),
      headMarkup: get(config.headMarkup, ''),
      iconUrl: get(config.icons.iconUrl, icon512 as URLPath),
      maskIconColor: themeColor,
      maskIconUrl: get(config.icons.maskIconUrl, '' as URLPath),
      seo: {
        jsonLD: {
          application: {
            applicationCategory: get(config.application?.category, ''),
            browserRequirements: get(
              config.application?.browserRequirements,
              ''
            ),
            featureList: get(config.application?.featureList, []),
            inLanguage: languages,
            name: applicationName,
            operatingSystem: get(config.application?.operatingSystem, ''),
            url: origin as HTTPSUrl,
          },
          organization: {
            logo: get(config.organization?.logoUrl, organizationLogo),
            name: get(config.organization?.name, applicationName),
            url: get<string>(config.organization?.url, origin) as HTTPSUrl,
          },
          page: {
            description,
            inLanguage: language,
            name: title,
            url: pageUrl,
          },
          site: { name: applicationName, url: origin as HTTPSUrl },
        },
        languageLinks: {
          alternateLanguages: languages,
          canonicalLanguage: config.canonicalLanguage,
          defaultLanguage: config.defaultLanguage,
          host: (origin === ''
            ? ''
            : new URL(origin).host) as `${string}.${string}`,
        },
        openGraph: {
          description,
          imageAlt: get(config.socialImage.alt, ''),
          imageHeight: get(config.socialImage.height, 630),
          imageUrl: get(config.socialImage.url, '' as HTTPSUrl),
          imageWidth: get(config.socialImage.width, 1200),
          locale: get(config.openGraphLocale, '' as OpenGraphLocale),
          siteName: applicationName,
          title,
          url: pageUrl,
        },
        twitter: {
          creator: get(config.twitter.creator, '' as `@${string}`),
          description,
          imageAlt: get(config.socialImage.alt, ''),
          imageUrl: get(config.socialImage.url, '' as HTTPSUrl),
          site: get(config.twitter.site, '' as `@${string}`),
          title,
          url: pageUrl,
        },
      },
      themeColor,
      title,
    },
    manifest: {
      backgroundColor: get(config.backgroundColor, themeColor),
      categories: get(config.manifest?.categories, []),
      description,
      display: get(config.manifest?.display, 'standalone'),
      icon192: icon192 as URLPath,
      icon512: icon512 as URLPath,
      id: get(config.manifest?.id, '/' as URLPath),
      lang: language,
      maskableIcon512: get(config.icons.maskableIcon512, icon512 as URLPath),
      name: applicationName,
      orientation: get(config.manifest?.orientation, 'any'),
      scope: get(config.manifest?.scope, '/' as URLPath),
      screenshots: get(config.manifest?.screenshots, []),
      shortName: get(config.shortName, applicationName),
      shortcuts: get(config.manifest?.shortcuts, []),
      startUrl: `/${language}`,
      themeColor,
    },
  }
}

function localizedValue<T>(
  value: Localized<T> | undefined,
  language: BCP47LanguageTag,
  defaultLanguage: BCP47LanguageTag,
  empty: T
): T {
  if (value === undefined) return empty
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value as T
  }

  const values = value as Partial<Record<BCP47LanguageTag, T>>
  return values[language] ?? values[defaultLanguage] ?? empty
}

export type Localized<T> = T | Partial<Record<BCP47LanguageTag, T>>

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
  defaultLanguage: BCP47LanguageTag
  description: Localized<string>
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
  minifyPasses?: number
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
