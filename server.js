const { createServer } = require('http')
const next = require('next')

const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()
const port = process.env.PORT || 3013

app.prepare().then(() => {
  const BASE = '/family-ledger-web'
  createServer((req, res) => {
    // Tailscale serve strips the /family-ledger-web prefix before forwarding.
    // Prepend it back so Next.js basePath routing works correctly.
    if (!req.url.startsWith(BASE)) {
      req.url = BASE + req.url
    }
    // Strip trailing slash to prevent Next.js 308 redirects (which browsers cache permanently)
    if (req.url !== BASE && req.url.endsWith('/')) {
      req.url = req.url.slice(0, -1)
    }
    handle(req, res)
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
