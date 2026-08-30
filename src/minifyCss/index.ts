import type { PathLike } from 'node:fs'
import { build } from 'esbuild'
import { transform } from 'lightningcss'

const minifiedOutputs = new Map<string, string>()

/** Bundles and minifies a CSS entrypoint into a dense string. */
export default async function minifyCss(entrypoint: PathLike): Promise<string> {
  const bundled = await build({
    entryPoints: [entrypoint.toString()],
    bundle: true,
    legalComments: 'none',
    minify: true,
    treeShaking: true,
    write: false,
    external: ['/assets/*'],
  })
  const source = bundled.outputFiles[0].text
  const cached = minifiedOutputs.get(source)
  if (cached !== undefined) return cached

  const { code } = transform({
    code: bundled.outputFiles[0].contents,
    filename: entrypoint.toString(),
    minify: true,
  })

  const output = new TextDecoder().decode(code).trim()
  minifiedOutputs.set(source, output)
  return output
}
