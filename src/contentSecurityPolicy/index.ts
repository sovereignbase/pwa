import { cspHash } from '../cspHash/index.js'

/** CSP directives whose source lists can be extended by a build. */
export type ContentSecurityPolicyDirective =
  | 'base-uri'
  | 'child-src'
  | 'connect-src'
  | 'default-src'
  | 'font-src'
  | 'form-action'
  | 'frame-ancestors'
  | 'frame-src'
  | 'img-src'
  | 'manifest-src'
  | 'media-src'
  | 'object-src'
  | 'prefetch-src'
  | 'script-src'
  | 'script-src-attr'
  | 'script-src-elem'
  | 'style-src'
  | 'style-src-attr'
  | 'style-src-elem'
  | 'worker-src'

/** Additional source expressions appended to the generated strict CSP. */
export type ContentSecurityPolicySources = Partial<
  Record<ContentSecurityPolicyDirective, readonly string[]>
>

/** Builds a strict CSP from the exact inline content of generated documents. */
export async function contentSecurityPolicy(
  documents: string[],
  additionalSources: ContentSecurityPolicySources = {}
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

  const directives = new Map<string, string[]>([
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['connect-src', ["'self'", 'https:', 'wss:']],
    ['font-src', ["'self'", 'data:']],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['img-src', ["'self'", 'data:', 'https:']],
    ['manifest-src', ["'self'"]],
    ['media-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['object-src', ["'none'"]],
    ['require-trusted-types-for', ["'script'"]],
    [
      'script-src',
      ["'self'", "'unsafe-inline'", scriptHashes, "'strict-dynamic'"],
    ],
    ['script-src-attr', ["'none'"]],
    ['script-src-elem', ["'self'", "'unsafe-inline'", scriptHashes]],
    ['style-src', ["'self'", "'unsafe-inline'", styleHashes]],
    ['style-src-attr', ["'none'"]],
    ['trusted-types', ['*']],
    ['worker-src', ["'self'", 'blob:']],
    ['upgrade-insecure-requests', []],
  ])

  const effectiveAdditionalSources: ContentSecurityPolicySources = {
    ...additionalSources,
    'script-src-elem': [
      ...(additionalSources['script-src'] ?? []),
      ...(additionalSources['script-src-elem'] ?? []),
    ],
  }

  for (const [directive, sources] of Object.entries(
    effectiveAdditionalSources
  )) {
    const combinedSources = new Set([
      ...(directives.get(directive) ?? []),
      ...sources,
    ])
    if (combinedSources.size > 1) combinedSources.delete("'none'")
    directives.set(directive, [...combinedSources])
  }

  return [...directives]
    .map(([directive, sources]) => [directive, ...sources].join(' '))
    .join('; ')
}
