// Service Worker — family-ledger
// Strategy: cache-first for immutable static assets only; network-first for everything else
// App Router HTML pages are NOT cached to avoid stale RSC payloads after deploys

const CACHE_NAME = 'family-ledger-v1'

// Only cache truly immutable assets (Next.js adds content hash to filenames)
const PRECACHE_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/manifest\.json$/,
]

function shouldCache(url) {
  const path = new URL(url).pathname
  return PRECACHE_PATTERNS.some((re) => re.test(path))
}

self.addEventListener('install', (event) => {
  // Minimal precache — only the manifest and icons, not HTML routes
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = event.request.url
  // Never intercept API calls — always go to network
  if (url.includes('/api/')) return

  if (shouldCache(url)) {
    // Cache-first for immutable static assets
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
  }
  // For HTML pages and other resources: let the browser handle normally (network-first by default)
})
