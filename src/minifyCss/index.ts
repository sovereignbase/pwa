import { transform } from 'lightningcss'

/** Minifies a complete CSS stylesheet into a dense string. */
export default function minifyCss(source: string): string {
  const { code } = transform({
    code: new TextEncoder().encode(source),
    minify: true,
  })

  return new TextDecoder().decode(code).trim()
}
