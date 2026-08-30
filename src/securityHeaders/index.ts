import { baseSecurityHeaders } from '../baseSecurityHeaders/index.js'

/** Combines a document CSP with shared response security headers. */
export function securityHeaders(
  contentSecurityPolicy: string
): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy,
    ...baseSecurityHeaders(),
  }
}
