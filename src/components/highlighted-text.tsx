'use client'

import { useMemo } from 'react'
import { splitForHighlight } from '@/lib/highlight-text'

interface HighlightedTextProps {
  text: string
  query: string
  className?: string
}

/**
 * Renders text with case-insensitive substring matches wrapped in `<mark>`
 * for visual highlight (Issue #340). Used by the records list to make
 * matched search terms pop within long descriptions.
 */
export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = useMemo(() => splitForHighlight(text, query), [text, query])
  if (segments.length === 0) return null
  if (segments.length === 1 && !segments[0].isMatch) {
    return <span className={className}>{segments[0].text}</span>
  }
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.isMatch ? (
          <mark
            key={i}
            className="bg-[var(--primary)]/20 text-[var(--foreground)] rounded-[2px] px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}
