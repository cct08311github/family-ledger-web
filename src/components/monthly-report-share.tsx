'use client'

import { useMemo, useState } from 'react'
import { generateMonthlyReport } from '@/lib/monthly-report'
import { useToast } from '@/components/toast'
import type { Expense } from '@/lib/types'

interface MonthlyReportShareProps {
  expenses: Expense[]
  /** Selected month (year + 0-indexed month). */
  selectedMonth: { year: number; month: number }
  /** Optional previous-month total for delta calculation. */
  previousMonthTotal?: number | null
}

/**
 * One-click monthly report sharing (Issue #345). Generates a multi-line
 * formatted text and either invokes Web Share API (mobile-friendly,
 * routes to LINE/WhatsApp/SMS picker) or copies to clipboard as
 * fallback. Renders silently when no data for selected month.
 */
export function MonthlyReportShare({
  expenses,
  selectedMonth,
  previousMonthTotal,
}: MonthlyReportShareProps) {
  const [busy, setBusy] = useState(false)
  const { addToast } = useToast()

  const report = useMemo(
    () =>
      generateMonthlyReport({
        expenses,
        year: selectedMonth.year,
        month: selectedMonth.month,
        previousMonthTotal,
      }),
    [expenses, selectedMonth.year, selectedMonth.month, previousMonthTotal],
  )

  if (!report.hasData) return null

  async function handleShare() {
    if (busy) return
    setBusy(true)
    try {
      const monthLabel = `${selectedMonth.year}/${String(selectedMonth.month + 1).padStart(2, '0')}`
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({
            title: `${monthLabel} 家計月報`,
            text: report.text,
          })
          return
        } catch (e) {
          // AbortError = user cancelled — silent.
          if (e instanceof Error && e.name === 'AbortError') return
          // Otherwise fall through to clipboard
        }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(report.text)
        addToast('已複製月報到剪貼板', 'success')
      } else {
        addToast('無法分享', 'warning')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] hover:bg-[var(--muted)] transition disabled:opacity-50"
      aria-label="分享月報"
      title="分享月度摘要文字"
    >
      <span aria-hidden>📋</span>
      分享月報
    </button>
  )
}
