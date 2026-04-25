'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { detectCatchupNudge } from '@/lib/catchup-detector'
import type { Expense } from '@/lib/types'

interface CatchupNudgeProps {
  expenses: Expense[]
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Friendly nudge banner when the user hasn't recorded in a while
 * (Issue #288). Surfaces *while memory is fresh* — the moment they open
 * the app — and links to /expense/new with a pre-filled date so the user
 * can backfill in two taps.
 *
 * Dismiss is session-only (useState) — reload reveals it again. Persistent
 * dismiss would risk silencing real gaps.
 */
export function CatchupNudge({ expenses }: CatchupNudgeProps) {
  const [dismissed, setDismissed] = useState(false)
  const nudge = useMemo(() => detectCatchupNudge({ expenses }), [expenses])

  if (!nudge || dismissed) return null

  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)

  return (
    <div
      className="rounded-2xl border p-4 space-y-2 animate-fade-up"
      style={{
        borderColor: 'color-mix(in oklch, var(--primary), transparent 70%)',
        backgroundColor: 'color-mix(in oklch, var(--primary), transparent 92%)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>📅</span>
        <span>已 {nudge.daysGap} 天沒記帳了</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="關閉提醒"
          className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition px-1"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        想起這幾天有什麼支出嗎？最後一次記錄是 {nudge.lastRecordedDate}。
      </p>
      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/expense/new?date=${formatDate(yesterday)}`}
          className="text-xs px-3 py-1.5 rounded-lg btn-primary btn-press whitespace-nowrap"
        >
          記補昨天
        </Link>
        <Link
          href={`/expense/new?date=${formatDate(today)}`}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] whitespace-nowrap"
        >
          記補今天
        </Link>
      </div>
    </div>
  )
}
