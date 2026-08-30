import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import minifyCss from '../../src/minifyCss/index.js'
import minifyHtml from '../../src/minifyHtml/index.js'
import minifyJs from '../../src/minifyJs/index.js'

describe('minifiers', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pwa-minifiers-'))
  })

  it('bundles source text, applies defines, tree-shakes, and runs Terser', async () => {
    const output = await minifyJs(
      {
        source:
          'const unused="remove-me";if(false)console.log(unused);globalThis.result=VALUE',
      },
      { define: { VALUE: '42' }, passes: 2 }
    )

    expect(output).toBe('globalThis.result=42;')
    expect(output).not.toContain('\n')
    await expect(
      minifyJs(
        {
          source:
            'const unused="remove-me";if(false)console.log(unused);globalThis.result=VALUE',
        },
        { define: { VALUE: '42' }, passes: 2 }
      )
    ).resolves.toBe(output)
  })

  it('bundles JavaScript file paths and URLs with default options', async () => {
    const dependency = join(directory, 'dependency.js')
    const entrypoint = join(directory, 'entrypoint.js')
    await writeFile(dependency, 'export const answer=40+2')
    await writeFile(
      entrypoint,
      'import{answer}from"./dependency.js";globalThis.answer=answer'
    )

    const pathOutput = await minifyJs(entrypoint, { passes: 1 })
    const urlOutput = await minifyJs(pathToFileURL(entrypoint))
    expect(pathOutput).toContain('globalThis.answer=42')
    expect(urlOutput).toContain('globalThis.answer=42')
  })

  it('bundles and minifies CSS', async () => {
    await writeFile(join(directory, 'base.css'), ':root { --accent: red; }')
    const entrypoint = join(directory, 'style.css')
    await writeFile(
      entrypoint,
      '@import "./base.css"; body { color: var(--accent); margin: 0px 0px 0px 0px; }'
    )

    const expected = ':root{--accent:red}body{color:var(--accent);margin:0}'
    await expect(minifyCss(entrypoint)).resolves.toBe(expected)
    await expect(minifyCss(entrypoint)).resolves.toBe(
      ':root{--accent:red}body{color:var(--accent);margin:0}'
    )
  })

  it('minifies HTML and its inline CSS and JavaScript', async () => {
    const output = await minifyHtml(`<!DOCTYPE html>
      <!-- remove -->
      <html><head><style>body { margin: 0px; }</style></head>
      <body><input disabled="disabled"><script>const unused = 1; window.ready = true;</script></body></html>`)

    expect(output).not.toContain('\n')
    expect(output).not.toContain('remove')
    expect(output).not.toContain('unused')
    expect(output).toContain('<style>body{margin:0}</style>')
    await expect(
      minifyHtml(`<!DOCTYPE html>
      <!-- remove -->
      <html><head><style>body { margin: 0px; }</style></head>
      <body><input disabled="disabled"><script>const unused = 1; window.ready = true;</script></body></html>`)
    ).resolves.toBe(output)
  })
})
