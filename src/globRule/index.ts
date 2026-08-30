/** Compiles a URL glob or preserves an explicitly supplied regular expression. */
export function globRule(pattern: string | RegExp): {
  absolute: boolean
  flags: string
  source: string
} {
  if (pattern instanceof RegExp) {
    return { absolute: true, flags: pattern.flags, source: pattern.source }
  }

  let source = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*'
        index += 1
      } else {
        source += '[^/]*'
      }
    } else if (character === '?') {
      source += '.'
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }

  return {
    absolute: pattern.includes('://'),
    flags: '',
    source: `${source}$`,
  }
}
