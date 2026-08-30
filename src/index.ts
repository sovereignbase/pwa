import type { PathLike } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import { cp, mkdir, mkdtempDisposable, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { BCP47LanguageTag } from '@sovereignbase/utils'
import { build, type Plugin } from 'esbuild'
import minifyCss from './minifyCss/index.js'
import minifyJs from './minifyJs/index.js'

export async function pwaize(config: PWAizeConfig): Promise<void> {
  await using temporaryDirectory = await mkdtempDisposable(
    join(tmpdir(), '@sovereignbase-pwa-')
  )

  const outputDirectory = join(config.outDir.toString(), 'web')
  const buildId = crypto.randomUUID()
  const minifyPasses = config.minifyPasses ?? 3

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    join(outputDirectory, '@sovereignbase/pwa:pwaize-build-id.txt'),
    buildId
  )

  for (const directory of [config.assetsDir, config.i18nDir]) {
    if (directory === undefined) continue

    const sourceDirectory = directory.toString()
    await cp(sourceDirectory, join(outputDirectory, basename(sourceDirectory)), {
      recursive: true,
    })
  }

  const entrypointBuild = await build({
    entryPoints: [config.entrypoint.toString()],
    bundle: true,
    minify: true,
    treeShaking: true,
    write: false,
  })
  const entrypoint = await minifyJs(
    entrypointBuild.outputFiles[0].text,
    minifyPasses
  )

  const stylesheetBuild = await build({
    entryPoints: [config.stylesheet.toString()],
    bundle: true,
    minify: true,
    treeShaking: true,
    write: false,
  })
  const stylesheet = minifyCss(stylesheetBuild.outputFiles[0].text)

  const serviceWorkerPath = join(temporaryDirectory.path, 'ServiceWorker')

  await build({
    entryPoints: [new URL('./serviceWorker/entrypoint.js', import.meta.url).pathname],
    outfile: serviceWorkerPath,
    bundle: true,
    minify: true,
    treeShaking: true,
    define: {
      buildId: JSON.stringify(buildId),
      customInitialize:
        config.serviceWorker?.initialize === undefined
          ? 'undefined'
          : `(${config.serviceWorker.initialize.toString()})`,
      customWaitUntil:
        config.serviceWorker?.waitUntil === undefined
          ? 'undefined'
          : `(${config.serviceWorker.waitUntil.toString()})`,
      entrypoint: JSON.stringify(entrypoint),
      stylesheet: JSON.stringify(stylesheet),
    },
    plugins: [terserPlugin(serviceWorkerPath, minifyPasses)],
  })

  await writeFile(
    join(outputDirectory, 'ServiceWorker'),
    await readFile(serviceWorkerPath, 'utf8')
  )
}

const terserPlugin = (outputFile: string, passes: number): Plugin => ({
  name: '@sovereignbase/pwa:terser',

  setup(build): void {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return

      const source = await readFile(outputFile, 'utf8')
      await writeFile(outputFile, await minifyJs(source, passes))
    })
  },
})

export type PWAizeConfig = {
  defaultLanguage: BCP47LanguageTag
  canonicalLanguage: BCP47LanguageTag
  alternateLanguages: BCP47LanguageTag[]

  /** CSS entrypoint bundled and inlined into every generated document. */
  stylesheet: PathLike | FileHandle

  /** JavaScript entrypoint bundled and inlined into every generated document. */
  entrypoint: PathLike | FileHandle

  /** Directory where generated PWA files are written. */
  outDir: PathLike | FileHandle

  /** Directory copied below `outDir/web` and included in the precache. */
  assetsDir?: PathLike | FileHandle

  /** Directory copied below `outDir/web` and included in the precache. */
  i18nDir?: PathLike | FileHandle

  /** Number of outer Terser rounds and compression passes per round. */
  minifyPasses?: number

  serviceWorker?: {
    /** Runs synchronously whenever the Service Worker starts. */
    initialize?: () => void

    /** Background startup work attached to Service Worker events. */
    waitUntil?: () => Promise<void>
  }

  _headersFile?: boolean
}
