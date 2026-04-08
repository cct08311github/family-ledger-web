'use client'

import { useGroupData } from '@/lib/group-data-context'

export function ConnectionBanner() {
  const { syncError } = useGroupData()

  if (!syncError) return null

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--destructive), transparent 85%)',
        color: 'var(--destructive)',
      }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true">⚠</span>
        <span>{syncError}</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-colors hover:opacity-80"
        style={{
          backgroundColor: 'var(--destructive)',
          color: '#fff',
        }}
      >
        重新載入
      </button>
    </div>
  )
}
