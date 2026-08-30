import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const build = spawnSync(process.execPath, ['test/index.js'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})
if (build.status !== 0) {
  process.stderr.write(build.stderr)
  process.exit(build.status ?? 1)
}

const publicDirectory = resolve('example/dist/web')
let apiValue = 0
const contentTypes = {
  '.html': 'text/html;charset=UTF-8',
  '.json': 'application/json;charset=UTF-8',
  '.svg': 'image/svg+xml;charset=UTF-8',
  '.txt': 'text/plain;charset=UTF-8',
  '.webmanifest': 'application/manifest+json;charset=UTF-8',
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4173')
  if (url.pathname === '/api/value') {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ value: ++apiValue }))
    return
  }

  const relativePath = normalize(decodeURIComponent(url.pathname)).replace(
    /^[/\\]+/,
    ''
  )
  let path = resolve(publicDirectory, relativePath)
  if (
    path !== publicDirectory &&
    !path.startsWith(`${publicDirectory}${sep}`)
  ) {
    response.writeHead(403).end()
    return
  }
  if (existsSync(path) && statSync(path).isDirectory())
    path = join(path, 'index.html')
  if (!existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end()
    return
  }

  response.setHeader(
    'content-type',
    contentTypes[extname(path)] ?? 'application/octet-stream'
  )
  if (
    url.pathname === '/ServiceWorker' ||
    url.pathname.endsWith('/pwaize-build-id.txt')
  ) {
    response.setHeader('cache-control', 'no-store')
  }
  createReadStream(path).pipe(response)
}).listen(4173, '127.0.0.1', () => {
  console.log('PWA test server listening on http://127.0.0.1:4173')
})
