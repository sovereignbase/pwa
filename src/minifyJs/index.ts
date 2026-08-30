import { minify } from 'terser'

/** Aggressively optimizes an already bundled JavaScript module. */
export default async function minifyJs(
  source: string,
  passes = 3
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

    if (result.code === undefined) {
      throw new Error('Terser did not produce JavaScript output')
    }

    output = result.code
  }

  return output
}
