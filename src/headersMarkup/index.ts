/** Serializes one deployment-header rule body. */
export function headersMarkup(headers: Record<string, string>): string {
  return `${Object.entries(headers)
    .map(([name, value]) => `  ${name}: ${value}`)
    .join('\n')}\n`
}
