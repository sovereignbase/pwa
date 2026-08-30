import type { PathLike } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { minify } from 'terser'

const minifiedOutputs = new Map<string, string>()

type JavaScriptInput = PathLike | { source: string }

type MinifyJsOptions = {
  banner?: string
  define?: Record<string, string>
  passes?: number
}

/** Bundles, tree-shakes, mangles, and repeatedly minifies JavaScript. */
export default async function minifyJs(
  input: JavaScriptInput,
  { banner, define, passes = 3 }: MinifyJsOptions = {}
): Promise<string> {
  const bundled = await build({
    ...(typeof input === 'object' && 'source' in input
      ? { stdin: { contents: input.source, resolveDir: process.cwd() } }
      : {
          entryPoints: [
            input instanceof URL ? fileURLToPath(input) : input.toString(),
          ],
        }),
    bundle: true,
    banner: banner === undefined ? undefined : { js: banner },
    define,
    format: 'esm',
    legalComments: 'none',
    minify: true,
    platform: 'browser',
    treeShaking: true,
    write: false,
  })

  const output = bundled.outputFiles[0].text
  const cacheKey = `${passes}\0${output}`
  const cached = minifiedOutputs.get(cacheKey)
  if (cached !== undefined) return cached

  const result = await repeatedlyMinify(output, passes)
  minifiedOutputs.set(cacheKey, result)
  return result
}

async function repeatedlyMinify(
  source: string,
  passes: number
): Promise<string> {
  let output = source

  for (let round = 0; round < passes; round += 1) {
    const result = await minify(output, {
      compress: {
        dead_code: true,
        passes,
        toplevel: true,
        unused: true,
      },
      ecma: 2024,
      format: {
        beautify: false,
        comments: false,
      },
      mangle: {
        toplevel: true,
      },
      module: true,
      toplevel: true,
    })

    /* v8 ignore next 3 -- Terser returns code or rejects for this input form. */
    if (result.code === undefined) {
      throw new Error('Terser did not produce JavaScript output')
    }

    output = result.code
  }

  return output
}
