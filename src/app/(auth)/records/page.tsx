'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useMembers } from '@/lib/hooks/use-members'
import { useCategories } from '@/lib/hooks/use-categories'
import { deleteExpense } from '@/lib/services/expense-service'
import { currency, toDate, fmtDateFull, paymentLabel } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { FilterChips } from '@/components/filter-chips'
import type { Expense } from '@/lib/types'

type FilterType = '全部' | '共同' | '個人'

export default function RecordsPage() {
  const { group } = useGroup()
  const { expenses, loading } = useExpenses()
  const { members } = useMembers()
  const { categories } = useCategories()
  const { user } = useAuth()

  const [filter, setFilter] = useState<FilterType>('全部')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [payerFilter, setPayerFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const hasAdvancedFilter = dateStart || dateEnd || payerFilter || categoryFilter

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      // Type tab filter
      if (filter === '共同' && !e.isShared) return false
      if (filter === '個人' && e.isShared) return false

      // Keyword search
      if (searchQuery) {
        const haystack = `${e.description} ${e.category} ${e.payerName}`.toLowerCase()
        if (!haystack.includes(searchQuery)) return false
      }

      // Date range
      if (dateStart || dateEnd) {
        const expDate = toDate(e.date)
        const expDateStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`
        if (dateStart && expDateStr < dateStart) return false
        if (dateEnd && expDateStr > dateEnd) return false
      }

      // Payer filter
      if (payerFilter && e.payerId !== payerFilter) return false

      // Category filter (match by name since expense stores category name)
      if (categoryFilter && e.category !== categoryFilter) return false

      return true
    })
  }, [expenses, filter, searchQuery, dateStart, dateEnd, payerFilter, categoryFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of filtered) {
      const key = fmtDateFull(toDate(e.date))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [filtered])

  const totalFiltered = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered])
  const isFiltering = searchQuery || hasAdvancedFilter

  function clearFilters() {
    setSearchInput('')
    setSearchQuery('')
    setDateStart('')
    setDateEnd('')
    setPayerFilter('')
    setCategoryFilter('')
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header row */}
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

      {/* Quick filter chips */}
      <div className="mb-3">
        <FilterChips
          expenses={expenses}
          dateStart={dateStart}
          dateEnd={dateEnd}
          categoryFilter={categoryFilter}
          onDateRangeChange={(s, e) => { setDateStart(s); setDateEnd(e) }}
          onCategoryChange={setCategoryFilter}
        />
      </div>

      {/* Search bar + advanced toggle */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none select-none">
            🔍
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜尋描述、分類、付款人…"
            className="w-full h-11 pl-9 pr-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
          />
        </div>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`h-11 px-3 rounded-lg border text-sm font-medium transition flex items-center gap-1 ${
            showAdvanced || hasAdvancedFilter
              ? 'border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_oklch,var(--primary),transparent_88%)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] bg-[var(--card)] hover:text-[var(--foreground)]'
          }`}
          title="進階篩選"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
          </svg>
          篩選
          {hasAdvancedFilter && (
            <span className="ml-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
          )}
        </button>
      </div>

      {/* Advanced filter panel */}
      {showAdvanced && (
        <div className="card p-4 mb-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">開始日期</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">結束日期</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">付款人</label>
              <select
                value={payerFilter}
                onChange={(e) => setPayerFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
              >
                <option value="">全部成員</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">分類</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
              >
                <option value="">全部分類</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          {hasAdvancedFilter && (
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition"
              >
                清除篩選
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter summary */}
      {isFiltering && !loading && (
        <div className="text-sm text-[var(--muted-foreground)] mb-3 flex items-center justify-between flex-wrap gap-2">
          <span>
            顯示 <span className="font-semibold text-[var(--foreground)]">{filtered.length}</span> 筆
            （共 {expenses.length} 筆）·
            合計 <span className="font-semibold" style={{ color: 'var(--primary)' }}>{currency(totalFiltered)}</span>
          </span>
          {(searchQuery || hasAdvancedFilter) && (
            <button
              onClick={clearFilters}
              className="text-xs underline underline-offset-2 hover:text-[var(--foreground)] transition"
            >
              清除所有篩選
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl opacity-30">{isFiltering ? '🔍' : '📋'}</div>
          <p className="font-medium text-[var(--foreground)]">
            {isFiltering ? '找不到符合條件的記錄' : '沒有記錄'}
          </p>
          {isFiltering && (
            <p className="text-sm text-[var(--muted-foreground)]">
              試試其他關鍵字，或{' '}
              <button onClick={clearFilters} className="underline underline-offset-2 hover:text-[var(--foreground)] transition">
                清除篩選條件
              </button>
            </p>
          )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((e) => (
                    <div key={e.id} className="card p-4 space-y-2 group relative">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                          style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}
                        >
                          {e.isShared ? '👥' : '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{e.description}</div>
                          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            {e.category} · {e.payerName}付
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {paymentLabel(e.paymentMethod)}{e.isShared ? ' · 共同' : ''}{e.receiptPath ? ' · 📷' : ''}
                        </div>
                        <div className="font-bold text-lg">{currency(e.amount)}</div>
                      </div>
                      <div className="absolute top-3 right-3 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/expense/${e.id}?groupId=${group?.id}`}
                          className="p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                          title="編輯"
                        >
                          ✏️
                        </Link>
                        <Link
                          href={`/expense/new?duplicate=${e.id}`}
                          className="p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                          title="複製"
                        >
                          📋
                        </Link>
                        <button
                          onClick={async () => {
                            if (!confirm(`確定要刪除「${e.description}」嗎？`)) return
                            if (!group?.id) return
                            try {
                              await deleteExpense(group.id, e.id, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
                            } catch {
                              alert('刪除失敗，請稍後再試')
                            }
                          }}
                          className="p-1.5 rounded-md hover:bg-[var(--muted)]"
                          title="刪除"
                          style={{ color: 'var(--destructive)' }}
                        >
                          🗑️
                        </button>
                      </div>
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
