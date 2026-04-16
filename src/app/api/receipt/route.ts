import { type NextRequest } from 'next/server'

/**
 * Receipt image proxy.
 *
 * Fetches an image from Firebase Storage server-side and streams it back
 * to the client as a same-origin response. This exists because:
 *
 * 1. iOS Safari on the tailnet-hosted PWA fails to render direct
 *    `firebasestorage.googleapis.com` URLs in `<img>` tags (likely a mix
 *    of CSP strictness, content blockers, and iOS PWA networking quirks).
 * 2. Next.js image optimization would re-encode every request and adds
 *    complexity for dynamically-sized receipt images.
 * 3. A thin proxy keeps the tokenized URL inside the server-to-server
 *    call and the client only sees a same-origin URL.
 *
 * Security:
 * - `path` must start with `receipts/` so the caller can't proxy arbitrary
 *   URLs or enumerate other Storage prefixes.
 * - The tokenized download URL is required — clients already obtained it
 *   via getDownloadURL() which respects Storage read rules. The proxy
 *   doesn't grant access beyond what the client already had.
 * - No credentials in logs: we redact tokens from error paths.
 */

const ALLOWED_BUCKET = 'family-ledger-784ed.firebasestorage.app'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  const token = req.nextUrl.searchParams.get('token')

  if (!path || !token) {
    return new Response('missing required params', { status: 400 })
  }
  if (!path.startsWith('receipts/')) {
    return new Response('invalid path prefix', { status: 400 })
  }
  // Allow only alphanum, slash, dash, underscore, dot — block path traversal + injection
  if (!/^[a-zA-Z0-9/_.-]+$/.test(path)) {
    return new Response('invalid path chars', { status: 400 })
  }
  // Token is a UUID — prevent arbitrary value
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(token)) {
    return new Response('invalid token', { status: 400 })
  }

  const upstreamUrl = `https://firebasestorage.googleapis.com/v0/b/${ALLOWED_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`

  try {
    const upstream = await fetch(upstreamUrl, { cache: 'no-store' })
    if (!upstream.ok) {
      return new Response(`upstream ${upstream.status}`, { status: upstream.status })
    }
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return new Response('not an image', { status: 415 })
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': contentType,
        // Short private cache so navigating back and forth is fast but token
        // rotations eventually take effect.
        'cache-control': 'private, max-age=300',
      },
    })
  } catch {
    return new Response('upstream fetch failed', { status: 502 })
  }
}
