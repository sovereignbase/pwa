import { Bytes } from '@sovereignbase/bytecodec'

/**
 * Calculates a CSP-compatible SHA-256 hash source for exact inline content.
 *
 * @param source Exact text content of a `script` or `style` element.
 * @returns A `sha256-` hash source without surrounding CSP quotes.
 */
export const cspHash = async (source: string): Promise<`sha256-${string}`> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Bytes.fromString(source) as BufferSource
  )

  return `sha256-${Bytes.toBase64String(digest)}`
}
