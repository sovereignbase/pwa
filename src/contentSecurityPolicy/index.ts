import { cspHash } from '../cspHash/index.js'

/** Builds a strict CSP from the exact inline content of generated documents. */
export async function contentSecurityPolicy(
  documents: string[]
): Promise<string> {
  const inlineScripts = documents.flatMap((document) =>
    [...document.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(
      (match) => match[1]
    )
  )
  const inlineStyles = documents.flatMap((document) =>
    [...document.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
      (match) => match[1]
    )
  )
  const hashes = async (sources: string[]): Promise<string> =>
    (
      await Promise.all(
        [...new Set(sources.length === 0 ? [''] : sources)].map(cspHash)
      )
    )
      .map((hash) => `'${hash}'`)
      .join(' ')
  const scriptHashes = await hashes(inlineScripts)
  const styleHashes = await hashes(inlineStyles)

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `connect-src 'self' https: wss:`,
    `font-src 'self' data:`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `img-src 'self' data: https:`,
    `manifest-src 'self'`,
    `media-src 'self' data: blob: https:`,
    `object-src 'none'`,
    `require-trusted-types-for 'script'`,
    `script-src 'self' 'unsafe-inline' ${scriptHashes} 'strict-dynamic'`,
    `script-src-attr 'none'`,
    `script-src-elem 'self' 'unsafe-inline' ${scriptHashes}`,
    `style-src 'self' 'unsafe-inline' ${styleHashes}`,
    `style-src-attr 'none'`,
    `trusted-types *`,
    `worker-src 'self' blob:`,
    'upgrade-insecure-requests',
  ].join('; ')
}
