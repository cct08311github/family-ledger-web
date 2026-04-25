'use client'

import Link from 'next/link'
import type { Expense } from '@/lib/types'

interface EmptyStateWelcomeProps {
  expenses: Expense[]
}

/**
 * Welcoming empty state for first-time users on the home page. All
 * analytical widgets silently render nothing without data — without
 * this, a new user sees only the quick-add bar and an unsettling void.
 * Renders only when expenses.length === 0.
 */
export function EmptyStateWelcome({ expenses }: EmptyStateWelcomeProps) {
  if (expenses.length > 0) return null

  return (
    <div
      className="card p-6 md:p-8 space-y-4 animate-fade-up text-center"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--primary) 5%, transparent)',
      }}
    >
      <div className="text-5xl" aria-hidden>
        💰
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--foreground)]">
          歡迎使用家計本！
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          記下第一筆支出，開始追蹤家庭花費
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link
          href="/expense/new"
          className="px-4 py-2 rounded-lg btn-primary btn-press text-sm font-medium"
        >
          + 新增第一筆
        </Link>
        <Link
          href="/settings"
          className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition text-sm"
        >
          設定群組成員
        </Link>
      </div>

      <ul className="text-xs text-left text-[var(--muted-foreground)] space-y-1.5 pt-3 border-t border-[var(--border)] max-w-md mx-auto">
        <li>💡 支援語音輸入「午餐 120」自動記帳</li>
        <li>📷 拍照上傳收據自動辨識金額</li>
        <li>👥 支援多人分攤、自動結算建議</li>
        <li>📊 累積一段時間後，自動分析消費模式</li>
      </ul>
    </div>
  )
}
