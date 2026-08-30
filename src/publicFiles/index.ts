import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/** Lists generated public file URLs recursively and deterministically. */
export async function publicFiles(
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
