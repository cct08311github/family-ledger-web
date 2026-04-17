'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Forward the uncaught error to system_logs so the owner can diagnose from
  // /settings/logs. UI below intentionally shows only `digest` to avoid leaking
  // stack details to the end user. Issue #177.
  useEffect(() => {
    logger.error('[ErrorBoundary:auth] Uncaught error', {
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-xl font-bold">載入失敗</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          無法載入頁面，請稍後再試。
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--muted-foreground)] font-mono">
            {error.digest}
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
  )
}
