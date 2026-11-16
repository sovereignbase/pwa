/** Returns security headers shared by installer and application responses. */
export function baseSecurityHeaders(
  contentSecurityPolicy?: string
): Record<string, string> {
  const frameAncestors = contentSecurityPolicy
    ?.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1]
    ?.trim()

  const xFrameOptions =
    frameAncestors === undefined || frameAncestors === "'none'"
      ? 'DENY'
      : frameAncestors === "'self'"
        ? 'SAMEORIGIN'
        : undefined

  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    ...(xFrameOptions && { 'X-Frame-Options': xFrameOptions }),
  }
}
