const { createServer } = require('http')
const next = require('next')

const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()
const port = process.env.PORT || 3013

app.prepare().then(() => {
  const BASE = '/family-ledger-web'
  createServer((req, res) => {
    // Tailscale serve proxies /family-ledger-web/* to this server,
    // stripping the prefix. Prepend it back for Next.js basePath routing.
    const qIdx = (req.url || '/').indexOf('?')
    const pathname = qIdx >= 0 ? req.url.slice(0, qIdx) : req.url
    const search = qIdx >= 0 ? req.url.slice(qIdx) : ''

    if (!pathname.startsWith(BASE)) {
      const clean = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
      req.url = BASE + clean + search
    }
    handle(req, res)
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
