'use client'

import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses, useMonthlyExpenses, useRecentExpenses } from '@/lib/hooks/use-expenses'
import { useSettlements } from '@/lib/hooks/use-settlements'
import { useMembers } from '@/lib/hooks/use-members'
import { simplifyDebts } from '@/lib/services/split-calculator'
import { currency, toDate, fmtDate } from '@/lib/utils'

export default function HomePage() {
  const { group, loading: groupLoading } = useGroup()
  const { expenses, loading: expLoading } = useExpenses(group?.id)
  const settlements = useSettlements(group?.id)
  const members = useMembers(group?.id)

  const monthly = useMonthlyExpenses(expenses)
  const recent = useRecentExpenses(expenses, 5)
  const nameMap = Object.fromEntries(members.map((m) => [m.id, m.name]))
  const debts = simplifyDebts(expenses, settlements, nameMap)

  const now = new Date()
  const monthLabel = `${now.getFullYear()}年 ${now.getMonth() + 1}月`
  const total = monthly.reduce((s, e) => s + e.amount, 0)
  const sharedTotal = monthly.filter((e) => e.isShared).reduce((s, e) => s + e.amount, 0)

  if (groupLoading || expLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-6xl opacity-30">👨‍👩‍👧‍👦</div>
        <h2 className="text-xl font-bold">歡迎使用家計本！</h2>
        <p className="text-[var(--muted-foreground)]">請先到設定新增家庭成員</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* 月支出摘要 */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          📅 {monthLabel}
        </div>
        <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
          {currency(total)}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">本月總支出</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 90%)' }}>
            <div className="text-xs text-[var(--muted-foreground)]">👥 共同支出</div>
            <div className="font-semibold">{currency(sharedTotal)}</div>
          </div>
          <div className="rounded-xl bg-[var(--muted)] p-3">
            <div className="text-xs text-[var(--muted-foreground)]">👤 個人支出</div>
            <div className="font-semibold">{currency(total - sharedTotal)}</div>
          </div>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">共 {monthly.length} 筆記錄</p>
      </div>

      {/* 誰欠誰 */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <div className="flex items-center gap-2 font-medium">💰 誰欠誰</div>
        {debts.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">目前沒有未結清的債務 🎉</p>
        ) : (
          debts.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--destructive), transparent 90%)', color: 'var(--destructive)' }}>
                {d.fromName}
              </span>
              <span className="text-[var(--muted-foreground)]">→</span>
              <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-semibold">
                {d.toName}
              </span>
              <span className="ml-auto font-semibold">{currency(d.amount)}</span>
            </div>
          ))
        )}
      </div>

      {/* 最近記錄 */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
        <div className="flex items-center gap-2 font-medium">📝 最近記錄</div>
        {recent.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">還沒有任何記錄，點下方「記帳」開始！</p>
        ) : (
          recent.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-1.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}>
                {e.isShared ? '👥' : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{e.description}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {fmtDate(toDate(e.date))} · {e.category} · {e.payerName}付
                </div>
              </div>
              <div className="font-semibold text-sm">{currency(e.amount)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
