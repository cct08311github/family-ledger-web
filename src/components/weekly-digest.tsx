'use client'

import { useState, useMemo } from 'react'
import { currency } from '@/lib/utils'
import { getWeekExpenses } from '@/lib/hooks/use-expenses'
import type { Expense } from '@/lib/types'

function getISOWeekId(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  const week = Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

const STORAGE_KEY = 'weekly-digest-dismissed'

interface WeeklyDigestProps {
  expenses: Expense[]
  /** Skip card wrapper + dismiss button when embedded (e.g. inside SummaryTabs). */
  noCard?: boolean
}

export function WeeklyDigest({ expenses, noCard }: WeeklyDigestProps) {
  const weekId = getISOWeekId()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(STORAGE_KEY) === weekId
  })

  const lastWeek = useMemo(() => getWeekExpenses(expenses, -1), [expenses])
  const thisWeek = useMemo(() => getWeekExpenses(expenses, 0), [expenses])

  const lastWeekTotal = useMemo(() => lastWeek.reduce((s, e) => s + e.amount, 0), [lastWeek])
  const thisWeekTotal = useMemo(() => thisWeek.reduce((s, e) => s + e.amount, 0), [thisWeek])

  // Top 3 categories by amount (last week)
  const topCategories = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of lastWeek) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [lastWeek])

  // Week-over-week change per category
  const thisWeekCategoryMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of thisWeek) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return map
  }, [thisWeek])

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, weekId)
    setDismissed(true)
  }

  // When embedded (noCard), the dismiss workflow no longer makes sense — the
  // parent owns visibility via tabs. Skip the localStorage gate in that case.
  if (!noCard && dismissed) return null
  if (lastWeek.length === 0) {
    if (noCard) {
      return (
        <div className="text-center py-6">
          <div className="text-3xl mb-2 opacity-50">📭</div>
          <p className="text-sm text-[var(--muted-foreground)]">上週還沒有記錄</p>
        </div>
      )
    }
    return null
  }

  const diff = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : null

  const content = (
    <div className="space-y-3">
      {!noCard && (
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">📅 上週回顧</div>
          <button
            onClick={handleDismiss}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            知道了
          </button>
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-black" style={{ color: 'var(--primary)' }}>
          {currency(lastWeekTotal)}
        </div>
        <div className="text-sm text-[var(--muted-foreground)]">
          上週總支出（{lastWeek.length} 筆）
        </div>
      </div>

      {/* Top 3 categories */}
      {topCategories.length > 0 && (
        <div className="space-y-1.5">
          {topCategories.map(([cat, amount]) => {
            const thisWeekAmt = thisWeekCategoryMap.get(cat) ?? 0
            const catDiff = amount > 0 ? Math.round(((thisWeekAmt - amount) / amount) * 100) : null
            const pct = lastWeekTotal > 0 ? Math.round((amount / lastWeekTotal) * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-2 text-sm">
                <div className="w-16 text-[var(--muted-foreground)]">{cat}</div>
                <div className="flex-1 h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: 'var(--primary)',
                      opacity: 0.7,
                    }}
                  />
                </div>
                <div className="w-20 text-right font-medium">{currency(amount)}</div>
                {catDiff !== null && (
                  <div className={`w-16 text-right text-xs ${catDiff > 0 ? 'text-[var(--destructive)]' : 'text-green-600 dark:text-green-400'}`}>
                    {catDiff > 0 ? '↑' : catDiff < 0 ? '↓' : '→'} {Math.abs(catDiff)}%
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Week comparison */}
      {diff !== null && (
        <div className="text-xs text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]">
          本週至今 {currency(thisWeekTotal)}，
          {diff === 0 ? '與上週持平' : (
            <span className={diff > 0 ? 'text-[var(--destructive)]' : 'text-green-600 dark:text-green-400'}>
              比上週{diff > 0 ? '多' : '少'} {Math.abs(diff)}%
            </span>
          )}
        </div>
      )}
    </div>
  )

  return noCard ? content : (
    <div className="card p-5 animate-fade-up border-l-4 border-l-[var(--primary)]">{content}</div>
  )
}
