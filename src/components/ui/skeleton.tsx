'use client'

interface SkeletonProps {
  className?: string
  /** ARIA label for screen readers; defaults to "載入中". */
  label?: string
}

/**
 * Minimal skeleton placeholder — animated gray block using existing CSS
 * tokens so it respects light/dark themes. Used to replace spinner-only
 * loading states across the app (Issue #234) and improve perceived speed.
 */
export function Skeleton({ className, label = '載入中' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`animate-pulse bg-[var(--muted)] rounded-md ${className ?? ''}`}
    />
  )
}

/**
 * Common page-level skeleton: a stack of blocks approximating a card grid.
 * Use when the page has a uniform list/grid layout.
 */
export function SkeletonPageGrid({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <Skeleton className="h-24" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}
