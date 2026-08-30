import type { PathLike } from 'node:fs'
import { build } from 'esbuild'
import { transform } from 'lightningcss'

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
  const { code } = transform({
    code: bundled.outputFiles[0].contents,
    filename: entrypoint.toString(),
    minify: true,
  })

  return new TextDecoder().decode(code).trim()
}
