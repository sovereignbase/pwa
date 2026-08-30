import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import minifyJs from '../minifyJs/index.js'

/** Bundles and minifies script modules while copying non-script files. */
export async function buildScriptDirectory(
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
