import type { PathLike } from 'node:fs'
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'
import type { BCP47LanguageTag } from '@sovereignbase/utils'
import type { DocumentMarkupOptions } from './.types/index.js'
import { documentMarkup } from './htmlDocument/index.js'
import minifyCss from './minifyCss/index.js'
import minifyHtml from './minifyHtml/index.js'
import minifyJs from './minifyJs/index.js'
import {
  webManifest,
  type WebManifestOptions,
} from './webManifest/index.js'

export async function pwaize(config: PWAizeConfig): Promise<void> {
  const outputDirectory = join(config.outDir.toString(), 'web')
  const buildId = crypto.randomUUID()
  const minifyPasses = config.minifyPasses ?? 3
  const serviceWorkerPath = '/ServiceWorker'

  await mkdir(outputDirectory, { recursive: true })

  for (const directory of [config.assetsDir, config.i18nDir]) {
    if (directory === undefined) continue

    const sourceDirectory = directory.toString()
    await cp(sourceDirectory, join(outputDirectory, basename(sourceDirectory)), {
      recursive: true,
    })
  }

  const stylesheet = await minifyCss(config.stylesheet)
  const entrypoint = await minifyJs(config.entrypoint, {
    passes: minifyPasses,
  })
  const installer = await minifyJs(
    {
      source: `const registration=await navigator.serviceWorker.register(${JSON.stringify(serviceWorkerPath)},{scope:"/",type:"module"});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)location.reload();`,
    },
    { passes: minifyPasses }
  )
  const documents: Record<string, string> = {}
  const languages = [config.defaultLanguage, ...config.alternateLanguages]

  for (const language of languages) {
    const localized = config.languages[language]
    if (localized === undefined) {
      throw new Error(`Missing PWA configuration for language "${language}"`)
    }

    const languageDirectory = join(outputDirectory, language)
    const manifestPath = `/${language}/manifest.webmanifest` as const
    const manifest = webManifest({
      ...localized.manifest,
      lang: language,
    })

    await mkdir(languageDirectory, { recursive: true })
    await writeFile(join(languageDirectory, 'manifest.webmanifest'), manifest)

    documents[language] = await minifyHtml(
      await documentMarkup({
        ...localized.document,
        language,
        stylesheet,
        entrypoint,
        manifestUrl: manifestPath,
      })
    )
    const installerDocument = await minifyHtml(
      await documentMarkup({
        ...localized.document,
        language,
        stylesheet: '',
        entrypoint: installer,
        manifestUrl: manifestPath,
      })
    )

    await writeFile(join(languageDirectory, 'index.html'), installerDocument)

    if (language === config.defaultLanguage) {
      await writeFile(join(outputDirectory, 'index.html'), installerDocument)
      await writeFile(join(outputDirectory, 'manifest.webmanifest'), manifest)
    }
  }

  const buildIdPath = join(
    outputDirectory,
    '@sovereignbase',
    'pwa',
    'pwaize-build-id.txt'
  )
  await mkdir(join(outputDirectory, '@sovereignbase', 'pwa'), {
    recursive: true,
  })
  await writeFile(buildIdPath, buildId)

  if (config._headersFile === true) {
    await writeFile(
      join(outputDirectory, '_headers'),
      `/${serviceWorkerPath.slice(1)}\n  Cache-Control: no-cache\n  Content-Type: text/javascript;charset=UTF-8\n\n/*\n  X-Content-Type-Options: nosniff\n`
    )
  }

  const precache = [
    ...(await publicFiles(outputDirectory)),
    ...(config.serviceWorker?.precache ?? []),
  ]
  const bypassRules = (config.serviceWorker?.bypass ?? []).map(globRule)
  const serviceWorker = await minifyJs(
    new URL('./serviceWorker/entrypoint.js', import.meta.url),
    {
      define: {
        buildId: JSON.stringify(buildId),
        bypassRules: JSON.stringify(bypassRules),
        customInitialize:
          config.serviceWorker?.initialize === undefined
            ? 'undefined'
            : `(${config.serviceWorker.initialize.toString()})`,
        customWaitUntil:
          config.serviceWorker?.waitUntil === undefined
            ? 'undefined'
            : `(${config.serviceWorker.waitUntil.toString()})`,
        defaultLanguage: JSON.stringify(config.defaultLanguage),
        documents: JSON.stringify(documents),
        precache: JSON.stringify(precache),
      },
      passes: minifyPasses,
    }
  )

  await writeFile(join(outputDirectory, serviceWorkerPath.slice(1)), serviceWorker)
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
    return {
      absolute: true,
      flags: pattern.flags,
      source: pattern.source,
    }
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

export type PWAizeConfig = {
  defaultLanguage: BCP47LanguageTag
  canonicalLanguage: BCP47LanguageTag
  alternateLanguages: BCP47LanguageTag[]

  languages: Record<
    string,
    {
      document: Omit<
        DocumentMarkupOptions,
        'entrypoint' | 'language' | 'manifestUrl' | 'stylesheet'
      >
      manifest: Omit<WebManifestOptions, 'lang'>
    }
  >

  stylesheet: PathLike
  entrypoint: PathLike
  outDir: PathLike

  assetsDir?: PathLike
  i18nDir?: PathLike
  minifyPasses?: number

  serviceWorker?: {
    bypass?: Array<string | RegExp>
    precache?: `/${string}`[]
    initialize?: () => void
    waitUntil?: () => Promise<void>
  }

  _headersFile?: boolean
}
