'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  parseAmountRangeParam,
  matchesAmountRange,
  type AmountRangeKey,
} from '@/lib/amount-range-filter'
import { AmountRangeChips } from '@/components/amount-range-chips'
import { DescriptionPriceTrend } from '@/components/description-price-trend'
import { computeFilterStats } from '@/lib/filter-stats'
import { HighlightedText } from '@/components/highlighted-text'
import {
  getRangePreset,
  matchActivePreset,
  presetLabel,
  PRESET_KEYS,
  type DateRangePresetKey,
} from '@/lib/date-range-presets'
import { useSwipe } from '@/hooks/use-swipe'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useCurrentMember } from '@/lib/hooks/use-current-member'
import { useMembers } from '@/lib/hooks/use-members'
import { useCategories } from '@/lib/hooks/use-categories'
import { deleteExpense, updateExpense, loadMoreExpenses } from '@/lib/services/expense-service'
import { recomputeSplitsForAmount } from '@/lib/scale-splits'
import { InlineExpenseEditRow } from '@/components/inline-expense-edit-row'
import { categoryColor } from '@/lib/category-color'
import { logger } from '@/lib/logger'
import { currency, toDate, fmtDateFull, paymentLabel } from '@/lib/utils'
import { useAuth, getActor } from '@/lib/auth'
import { useGroupData } from '@/lib/group-data-context'
import { FilterChips } from '@/components/filter-chips'
import { useToast } from '@/components/toast'
import { ReceiptGallery } from '@/components/receipt-gallery'
import { normalizeReceiptPaths } from '@/lib/services/image-upload'
import type { Expense } from '@/lib/types'
import type { DocumentSnapshot } from 'firebase/firestore'
import {
  currentMonthRange,
  shiftMonth,
  parseYearMonth,
  isExactMonth,
  isCurrentMonth,
  formatMonthLabel,
} from '@/lib/month-nav'
import { expensesToCSV, buildCSVFilename } from '@/lib/expense-csv'

type FilterType = '全部' | '共同' | '個人'

export default function RecordsPage() {
  const { group } = useGroup()
  const { expenses: baseExpenses, loading } = useExpenses()
  const { hasMoreExpenses: contextHasMore, lastExpenseDoc: contextLastDoc } = useGroupData()
  const { members } = useMembers()
  const { categories } = useCategories()
  const { user } = useAuth()
  const { currentMemberId } = useCurrentMember(group?.id)
  const { addToast } = useToast()
  const searchParams = useSearchParams()

  // Inline edit (Issue #230). Only one row editable at a time.
  const [editingId, setEditingId] = useState<string | null>(null)
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).map((c) => c.name),
    [categories],
  )

  async function handleInlineSave(expense: Expense, next: { amount: number; category: string }) {
    if (!group?.id) return
    const newSplits = recomputeSplitsForAmount(expense, next.amount)
    try {
      await updateExpense(
        group.id,
        expense.id,
        {
          amount: next.amount,
          category: next.category,
          splits: newSplits,
        },
        getActor(user),
      )
      addToast('已更新金額／類別', 'success')
      setEditingId(null)
    } catch (e) {
      logger.error('[Records] Inline save failed', e)
      addToast('儲存失敗，請重試', 'error')
      throw e // let InlineExpenseEditRow surface inline error too
    }
  }

  // Extra expenses loaded via pagination beyond the initial 200
  const [extraExpenses, setExtraExpenses] = useState<Expense[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)

  // Effect 1: reset extra pages only when the group changes
  useEffect(() => {
    setExtraExpenses([])
    setHasMore(false)
    setLastDoc(null)
  }, [group?.id])

  // Effect 2: sync cursor state only when we haven't paginated yet
  useEffect(() => {
    if (!loading && extraExpenses.length === 0) {
      setHasMore(contextHasMore)
      setLastDoc(contextLastDoc)
    }
  }, [loading, contextHasMore, contextLastDoc])

  const expenses = useMemo(() => [...baseExpenses, ...extraExpenses], [baseExpenses, extraExpenses])

  const [galleryPaths, setGalleryPaths] = useState<string[] | null>(null)
  const [filter, setFilter] = useState<FilterType>('全部')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '')
  const [searchQuery, setSearchQuery] = useState(() =>
    (searchParams.get('q') ?? '').trim().toLowerCase(),
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  // Default to current month for efficiency — families mostly care about the
  // current monthly summary. URL params (`?start=&end=`) override for deep
  // links (e.g., from statistics page drill-downs). Use `||` not `??` so an
  // empty string `?start=` also falls back to the default (not treated as
  // "all time"). Issue #185.
  const [dateStart, setDateStart] = useState(() => searchParams.get('start') || currentMonthRange().start)
  const [dateEnd, setDateEnd] = useState(() => searchParams.get('end') || currentMonthRange().end)
  // Init from URL ?payer=<id> for home-page drill-downs (Issue #264).
  const [payerFilter, setPayerFilter] = useState(() => searchParams.get('payer') ?? '')
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') ?? '')
  // Amount-range quick filter (Issue #221). Initial value from URL; sync back
  // to URL on change so the chip selection persists across reloads and can be
  // shared via link.
  const [amountRange, setAmountRange] = useState<AmountRangeKey>(() =>
    parseAmountRangeParam(searchParams.get('amount')),
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (amountRange === 'all') params.delete('amount')
    else params.set('amount', amountRange)
    const qs = params.toString()
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [amountRange])

  // Category filter URL sync (Issue #244). Shareable deep link + browser back.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (!categoryFilter) params.delete('category')
    else params.set('category', categoryFilter)
    const qs = params.toString()
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [categoryFilter])

  // Derived: which month does the current date filter represent?
  // - Exact-month range → show prev/next month navigation
  // - Custom or all-time → show "自訂區間" and a "回本月" shortcut
  const monthNav = useMemo(() => {
    if (!dateStart || !dateEnd) return { kind: 'custom' as const }
    if (!isExactMonth(dateStart, dateEnd)) return { kind: 'custom' as const }
    const ym = parseYearMonth(dateStart)
    if (!ym) return { kind: 'custom' as const }
    return {
      kind: 'month' as const,
      year: ym.year,
      month: ym.month,
      isCurrent: isCurrentMonth(dateStart, dateEnd),
    }
  }, [dateStart, dateEnd])

  function jumpToMonth(delta: number) {
    if (monthNav.kind !== 'month') return
    const next = shiftMonth(monthNav.year, monthNav.month, delta)
    setDateStart(next.start)
    setDateEnd(next.end)
  }

  function jumpToCurrentMonth() {
    const curr = currentMonthRange()
    setDateStart(curr.start)
    setDateEnd(curr.end)
  }

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // "Advanced filter" means the user has narrowed beyond the default
  // current-month view. The default month is NOT treated as active filtering
  // (so the summary bar / indicator dots don't light up on plain page load).
  // Issue #185.
  const isOnCurrentMonth = isCurrentMonth(dateStart, dateEnd)
  const customDateRange = !!(dateStart || dateEnd) && !isOnCurrentMonth
  // amountRange belongs in the "active filter" set — when selected, the
  // filtered summary row should appear so users see the narrowed total.
  // Was missing when #221 introduced amountRange (Issue #246).
  const hasAdvancedFilter = customDateRange || !!payerFilter || !!categoryFilter || amountRange !== 'all'

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

      // Amount range filter (Issue #221)
      if (!matchesAmountRange(e.amount, amountRange)) return false

      return true
    })
  }, [expenses, filter, searchQuery, dateStart, dateEnd, payerFilter, categoryFilter, amountRange])

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
  const filterStats = useMemo(() => computeFilterStats({ expenses: filtered }), [filtered])
  const isFiltering = searchQuery || hasAdvancedFilter

  function clearFilters() {
    setSearchInput('')
    setSearchQuery('')
    // "Clear filters" resets to the default (current-month) view, not a
    // no-date-range "all time" view. Keeps semantics consistent with the new
    // default behavior added in Issue #185.
    const curr = currentMonthRange()
    setDateStart(curr.start)
    setDateEnd(curr.end)
    setPayerFilter('')
    setCategoryFilter('')
    setAmountRange('all')
  }

  function handleExportCSV() {
    if (typeof window === 'undefined' || filtered.length === 0) return
    // `filtered` is already scoped to the user's current view (month, category,
    // payer, search, type tab) — exporting exactly what they see is the least
    // surprising behaviour. Issue #207.
    const csv = expensesToCSV(
      filtered.map((e) => ({
        date: e.date,
        description: e.description,
        amount: e.amount,
        category: e.category,
        payerName: e.payerName,
        isShared: e.isShared,
        paymentMethod: paymentLabel(e.paymentMethod),
        note: e.note,
      })),
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = buildCSVFilename()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      URL.revokeObjectURL(url)
    }
    addToast(`已匯出 ${filtered.length} 筆記錄`, 'success')
  }

  async function handleLoadMore() {
    if (!group?.id || !lastDoc || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await loadMoreExpenses(group.id, lastDoc)
      // Filter by visibility (same logic as useExpenses hook)
      const visible = user
        ? result.expenses.filter((e) => e.isShared || e.createdBy === user.uid)
        : result.expenses
      setExtraExpenses((prev) => [...prev, ...visible])
      setHasMore(result.hasMore)
      setLastDoc(result.lastDoc)
    } catch {
      addToast('載入更多失敗，請稍後再試', 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  // Swipe: left = next month, right = previous month. Only fires when the
  // view is on an exact month (not a custom range). Touch-only so desktop
  // mouse users aren't affected.
  const swipeRef = useRef<HTMLDivElement | null>(null)
  useSwipe(swipeRef, {
    onSwipeLeft: () => {
      if (monthNav.kind === 'month') jumpToMonth(1)
    },
    onSwipeRight: () => {
      if (monthNav.kind === 'month') jumpToMonth(-1)
    },
  })

  // Pull-to-refresh: reset pagination so the Firestore subscription re-emits
  // the first page, and confirm with a toast (Issue #237). Firestore realtime
  // listener reconnects automatically — no explicit refetch needed.
  const pullState = usePullToRefresh(swipeRef, {
    onRefresh: async () => {
      setExtraExpenses([])
      setHasMore(contextHasMore)
      setLastDoc(contextLastDoc)
      await new Promise((r) => setTimeout(r, 300))
      addToast('已更新', 'success')
    },
  })

  return (
    <div ref={swipeRef} className="p-4 md:p-8 max-w-5xl mx-auto" style={{ transform: pullState.offset > 0 ? `translateY(${pullState.offset}px)` : undefined, transition: pullState.offset === 0 ? 'transform 200ms ease-out' : undefined }}>
      {(pullState.offset > 0 || pullState.refreshing) && (
        <div
          className="flex items-center justify-center text-xs text-[var(--muted-foreground)] -mt-2 mb-2"
          style={{ height: Math.min(pullState.offset, 64) }}
          aria-live="polite"
        >
          {pullState.refreshing
            ? '🔄 重新整理中…'
            : pullState.armed
              ? '放開以重新整理'
              : '⬇ 下拉可重新整理'}
        </div>
      )}
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

      {/* Month navigation (Issue #185) */}
      <div className="mb-3 flex items-center gap-2">
        {monthNav.kind === 'month' ? (
          <>
            <button
              onClick={() => jumpToMonth(-1)}
              aria-label="上一個月"
              className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition flex items-center justify-center text-sm"
            >
              ◀
            </button>
            <div className="flex-1 text-center">
              <div className="text-sm font-semibold tabular-nums">
                {formatMonthLabel({ year: monthNav.year, month: monthNav.month })}
              </div>
              {monthNav.isCurrent && (
                <div className="text-[10px] text-[var(--muted-foreground)]">本月</div>
              )}
            </div>
            <button
              onClick={() => jumpToMonth(1)}
              aria-label="下一個月"
              className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition flex items-center justify-center text-sm"
            >
              ▶
            </button>
            {!monthNav.isCurrent && (
              <button
                onClick={jumpToCurrentMonth}
                className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition"
              >
                回本月
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 text-sm text-[var(--muted-foreground)]">
              自訂區間 {dateStart && dateEnd ? `(${dateStart} ~ ${dateEnd})` : ''}
            </div>
            <button
              onClick={jumpToCurrentMonth}
              className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition"
            >
              回本月
            </button>
          </>
        )}
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

      {/* Amount-range chips (Issue #221) */}
      <div className="mb-3">
        <AmountRangeChips value={amountRange} onChange={setAmountRange} />
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
            onKeyDown={(e) => {
              // ESC clears the search and unfocuses (Issue #270)
              if (e.key === 'Escape' && searchInput) {
                e.preventDefault()
                setSearchInput('')
                e.currentTarget.blur()
              }
            }}
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
          {/* 日期範圍快速 chips (Issue #342) */}
          {(() => {
            const active = matchActivePreset(dateStart, dateEnd)
            return (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-[var(--muted-foreground)] self-center mr-1">
                  快速選擇：
                </span>
                {PRESET_KEYS.map((key: DateRangePresetKey) => {
                  const isActive = active === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const r = getRangePreset(key)
                        setDateStart(r.start)
                        setDateEnd(r.end)
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground,_white)]'
                          : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'
                      }`}
                    >
                      {presetLabel(key)}
                    </button>
                  )
                })}
              </div>
            )
          })()}
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

      {/* Filter summary + export */}
      {!loading && filtered.length > 0 && (
        <div className="mb-3 space-y-1">
        <div className="text-sm text-[var(--muted-foreground)] flex items-center justify-between flex-wrap gap-2">
          {isFiltering ? (
            <span>
              顯示 <span className="font-semibold text-[var(--foreground)]">{filtered.length}</span> 筆
              （共 {expenses.length} 筆）·
              合計 <span className="font-semibold" style={{ color: 'var(--primary)' }}>{currency(totalFiltered)}</span>
            </span>
          ) : (
            <span>
              共 <span className="font-semibold text-[var(--foreground)]">{filtered.length}</span> 筆記錄
            </span>
          )}
          <div className="flex items-center gap-3">
            {(searchQuery || hasAdvancedFilter) && (
              <button
                onClick={clearFilters}
                className="text-xs underline underline-offset-2 hover:text-[var(--foreground)] transition"
              >
                清除所有篩選
              </button>
            )}
            <button
              onClick={() => handleExportCSV()}
              title="匯出目前顯示的支出為 CSV（Excel / Google Sheets 可開）"
              aria-label={`匯出 ${filtered.length} 筆記錄為 CSV`}
              className="text-xs px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition"
            >
              ⤓ 匯出 CSV
            </button>
          </div>
        </div>
        {filterStats && (
          <div className="text-xs text-[var(--muted-foreground)] flex items-center flex-wrap gap-x-3 gap-y-0.5">
            <span>avg <span className="text-[var(--foreground)] font-medium">{currency(filterStats.average)}</span></span>
            <span>median <span className="text-[var(--foreground)] font-medium">{currency(filterStats.median)}</span></span>
            <span>max <span className="text-[var(--foreground)] font-medium">{currency(filterStats.max)}</span></span>
            <span>min <span className="text-[var(--foreground)] font-medium">{currency(filterStats.min)}</span></span>
          </div>
        )}
        </div>
      )}

      {/* 同名描述價格走勢 (Issue #309) */}
      {!loading && searchQuery && (
        <DescriptionPriceTrend
          expenses={filtered}
          description={searchQuery}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3 py-4">
          <div className="animate-pulse bg-[var(--muted)] rounded-md h-5 w-24" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="animate-pulse bg-[var(--muted)] rounded-md h-24" />
            <div className="animate-pulse bg-[var(--muted)] rounded-md h-24" />
            <div className="animate-pulse bg-[var(--muted)] rounded-md h-24" />
          </div>
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
                  {items.map((e) => editingId === e.id ? (
                    <InlineExpenseEditRow
                      key={e.id}
                      expenseId={e.id}
                      initialAmount={e.amount}
                      initialCategory={e.category}
                      availableCategories={activeCategories}
                      splitIsEqual={!e.isShared || e.splitMethod === 'equal'}
                      onSave={(next) => handleInlineSave(e, next)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div key={e.id} className="card p-4 space-y-2 group relative">
                      <div className="flex items-start gap-3">
                        {(() => {
                          const color = categoryColor(e.category)
                          const isSelected = categoryFilter === e.category
                          return (
                            <button
                              type="button"
                              onClick={() => setCategoryFilter(isSelected ? '' : e.category)}
                              aria-pressed={isSelected}
                              aria-label={isSelected ? `清除類別篩選：${e.category}` : `篩選類別：${e.category}`}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                                isSelected ? 'ring-2 ring-[var(--primary)]' : ''
                              }`}
                              style={{ backgroundColor: color.bg, color: color.fg }}
                              title={isSelected ? `正在篩選：${e.category}（點擊清除）` : `點擊篩選類別：${e.category}`}
                            >
                              {e.isShared ? '👥' : '👤'}
                            </button>
                          )
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            <HighlightedText text={e.description} query={searchQuery} />
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            <HighlightedText text={e.category} query={searchQuery} /> ·{' '}
                            {currentMemberId && e.payerId === currentMemberId ? (
                              <span className="font-semibold text-[var(--foreground)]">我付</span>
                            ) : (
                              <>
                                <HighlightedText text={e.payerName} query={searchQuery} />付
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {paymentLabel(e.paymentMethod)}{e.isShared ? ' · 共同' : ''}
                          {(() => {
                            const paths = normalizeReceiptPaths(e)
                            if (paths.length === 0) return null
                            return (
                              <>
                                {' · '}
                                <button
                                  onClick={(ev) => {
                                    ev.preventDefault()
                                    ev.stopPropagation()
                                    setGalleryPaths(paths)
                                  }}
                                  aria-label={`檢視收據${paths.length > 1 ? `（${paths.length} 張）` : ''}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 -my-0.5 rounded hover:bg-[var(--muted)] transition relative z-10"
                                >
                                  <span>📷</span>
                                  {paths.length > 1 && <span className="text-[10px] font-semibold">{paths.length}</span>}
                                </button>
                              </>
                            )
                          })()}
                        </div>
                        <div className="font-bold text-lg">{currency(e.amount)}</div>
                      </div>
                      <div className="absolute top-3 right-3 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingId(e.id)}
                          className="p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                          title="快速改金額／類別"
                        >
                          ⚡
                        </button>
                        <Link
                          href={`/expense/${e.id}?groupId=${group?.id}`}
                          className="p-1.5 rounded-md hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                          title="完整編輯"
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
                              await deleteExpense(group.id, e.id, getActor(user))
                            } catch {
                              addToast('刪除失敗，請稍後再試', 'error')
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

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                    載入中…
                  </>
                ) : (
                  '載入更多'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {galleryPaths && (
        <ReceiptGallery paths={galleryPaths} onClose={() => setGalleryPaths(null)} />
      )}
    </div>
  )
}
