'use client'

import './globals.css'
import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Forward the uncaught root-level error to system_logs. See (auth)/error.tsx
  // for the per-route boundary; this one catches crashes that bubble past the
  // root layout (e.g., Providers throwing). Issue #177.
  useEffect(() => {
    logger.error('[ErrorBoundary:root] Uncaught error', {
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    })
  }, [error])

  return (
    <html lang="zh-TW">
      <body>
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-xl font-bold">發生錯誤</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              抱歉，發生了一些問題。請嘗試重新整理頁面。
            </p>
            {error.digest && (
              <p className="text-xs text-[var(--muted-foreground)] font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="w-full h-10 rounded-lg font-medium text-white"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              重新整理
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
