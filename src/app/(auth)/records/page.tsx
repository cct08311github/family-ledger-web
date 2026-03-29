'use client'

import { useState } from 'react'
import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { currency, toDate, fmtDateFull, paymentLabel } from '@/lib/utils'
import type { Expense } from '@/lib/types'

type FilterType = '全部' | '共同' | '個人'

export default function RecordsPage() {
  const { group } = useGroup()
  const { expenses, loading } = useExpenses(group?.id)
  const [filter, setFilter] = useState<FilterType>('全部')

  const filtered = expenses.filter((e) => {
    if (filter === '共同') return e.isShared
    if (filter === '個人') return !e.isShared
    return true
  })

  const grouped = new Map<string, Expense[]>()
  for (const e of filtered) {
    const key = fmtDateFull(toDate(e.date))
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">所有記錄</h1>
        <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1">
          {(['全部', '共同', '個人'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                filter === f
                  ? 'bg-[var(--card)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl opacity-30">📋</div>
          <p className="text-[var(--muted-foreground)]">沒有記錄</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([dateKey, items]) => {
            const dayTotal = items.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={dateKey}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{dateKey}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">{currency(dayTotal)}</span>
                </div>
                <div className="space-y-2">
                  {items.map((e) => (
                    <div key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}>
                        {e.isShared ? '👥' : '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.description}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {e.category} · {e.payerName}付 · {paymentLabel(e.paymentMethod)}
                          {e.isShared ? ' · 共同' : ''}
                          {(e.receiptPaths?.length ?? 0) > 0 && ` · 📷${e.receiptPaths.length}`}
                        </div>
                      </div>
                      <div className="font-semibold">{currency(e.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
