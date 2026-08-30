/** Serializes a callback as a standalone function expression. */
export function functionExpression(
  callback: (...arguments_: never[]) => unknown
): string {
  const source = callback.toString()
  if (/^(?:async\s+)?function\b|^(?:async\s+)?\(/.test(source)) {
    return `(${source})`
  }
  if (source.startsWith('async ')) {
    return `(async function ${source.slice('async '.length)})`
  }
  return `(function ${source})`
}
