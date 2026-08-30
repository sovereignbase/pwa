import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Hashes generated content and behavior-affecting configuration. */
export async function contentBuildId(
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
