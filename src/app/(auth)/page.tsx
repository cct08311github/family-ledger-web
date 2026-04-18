'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses, useMonthlyExpenses, useRecentExpenses } from '@/lib/hooks/use-expenses'
import { useSettlements } from '@/lib/hooks/use-settlements'
import { useMembers } from '@/lib/hooks/use-members'
import { simplifyDebts } from '@/lib/services/split-calculator'
import { TodaySummary } from '@/components/today-summary'
import { joinGroupByInviteCode } from '@/lib/services/group-service'
import { currency, toDate, fmtDate } from '@/lib/utils'
import { QuickAddBar } from '@/components/quick-add-bar'
import { WeeklyDigest } from '@/components/weekly-digest'
import { BudgetProgress } from '@/components/budget-progress'
import { RecentActivitySection } from '@/components/recent-activity-section'
import { generatePendingRecurring, confirmPendingExpense } from '@/lib/services/recurring-generator'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/toast'
import {
  filterConfirmable,
  summarizeConfirmResults,
  confirmToastFromSummary,
} from '@/lib/pending-confirmation'

function NoGroupView() {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    setJoining(true)
    setError(null)
    try {
      await joinGroupByInviteCode(code)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失敗')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="p-6 max-w-sm mx-auto space-y-6 pt-20">
      <div className="text-center space-y-2">
        <div className="text-6xl">👨‍👩‍👧‍👦</div>
        <h2 className="text-xl font-bold">歡迎使用家計本！</h2>
        <p className="text-sm text-[var(--muted-foreground)]">輸入邀請碼加入家庭群組，或到設定頁建立新群組</p>
      </div>

      <div className="card p-5 space-y-3 animate-fade-up stagger-2">
        <label className="text-sm font-medium block">輸入邀請碼</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="例如：A2B3C4"
          maxLength={6}
          className="w-full text-center text-2xl font-mono font-bold tracking-[0.3em] h-14 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={joining || code.length !== 6}
          className="w-full py-3 rounded-xl text-sm font-semibold btn-primary btn-press"
        >
          {joining ? '加入中...' : '加入群組'}
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { group, loading: groupLoading } = useGroup()
  const { expenses, loading: expLoading } = useExpenses()
  const { settlements } = useSettlements()
  const { members, loading: membersLoading } = useMembers()
  const { addToast } = useToast()
  const [confirmingPending, setConfirmingPending] = useState(false)

  const monthly = useMonthlyExpenses(expenses)
  const recent = useRecentExpenses(expenses, 5)
  const nameMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members])
  const debts = useMemo(() => simplifyDebts(expenses, settlements, nameMap), [expenses, settlements, nameMap])

  // Pending confirmation: auto-generated recurring expenses
  const pendingExpenses = useMemo(() => expenses.filter((e) => e.pendingConfirm), [expenses])

  /**
   * Confirm all pending auto-generated expenses in parallel. Issue #179.
   * Replaces a serial for-loop that had no loading state, no error feedback,
   * and silently swallowed mid-loop failures.
   */
  async function handleConfirmAllPending() {
    if (!group?.id || confirmingPending) return
    const confirmable = filterConfirmable(pendingExpenses)
    if (confirmable.length === 0) return
    setConfirmingPending(true)
    try {
      const results = await Promise.allSettled(
        confirmable.map((e) => confirmPendingExpense(group.id, e.id)),
      )
      const summary = summarizeConfirmResults(results)
      const toast = confirmToastFromSummary(summary)
      if (toast) addToast(toast.message, toast.level)
      // Aggregate rejections into a single logger.error so the log-service
      // rate limiter (MAX_WRITES_PER_MINUTE) doesn't silently drop entries
      // 31..N if a catastrophic outage causes many simultaneous failures.
      if (summary.fail > 0) {
        logger.error('[Home] confirmPendingExpense batch failures', {
          failed: summary.fail,
          total: summary.total,
          reasons: results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : [])),
        })
      }
    } finally {
      setConfirmingPending(false)
    }
  }

  // Trigger recurring expense generation on page load
  useEffect(() => {
    if (!group?.id) return
    generatePendingRecurring(group.id).catch((err) =>
      logger.error('[Home] recurring generation failed:', err),
    )
  }, [group?.id])

  const now = new Date()
  const monthLabel = `${now.getFullYear()}年 ${now.getMonth() + 1}月`
  const total = useMemo(() => monthly.reduce((s, e) => s + e.amount, 0), [monthly])
  const sharedTotal = useMemo(() => monthly.filter((e) => e.isShared).reduce((s, e) => s + e.amount, 0), [monthly])

  if (groupLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  // Show skeleton while data loads (instead of blocking spinner)
  const dataLoading = expLoading || membersLoading

  if (!group) {
    return <NoGroupView />
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4 md:space-y-6">
      {/* 快速記帳 */}
      <QuickAddBar />

      {/* 定期支出待確認 */}
      {pendingExpenses.length > 0 && (
        <div className="card p-4 flex items-center gap-3 animate-fade-up"
          style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 92%)' }}>
          <span className="text-xl">📌</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{pendingExpenses.length} 筆定期支出已自動記錄</p>
            <p className="text-xs text-[var(--muted-foreground)]">點擊確認或前往記錄頁檢視</p>
          </div>
          <button
            onClick={handleConfirmAllPending}
            disabled={confirmingPending}
            aria-busy={confirmingPending}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}>
            {confirmingPending ? '確認中…' : '全部確認'}
          </button>
          <button
            onClick={() => router.push('/records')}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] hover:bg-[var(--muted)]">
            查看
          </button>
        </div>
      )}

      {/* 每週回顧（可關閉） */}
      <WeeklyDigest expenses={expenses} />

      {/* 今日/本週摘要 */}
      <TodaySummary expenses={expenses} loading={dataLoading} />

      {/* 月度預算進度 */}
      <BudgetProgress group={group} expenses={expenses} />

      {/* Dashboard grid: 桌面版 2 欄，手機版單欄 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">

        {/* 月支出摘要 — 桌面版橫跨兩欄 */}
        <div className="md:col-span-2 card p-6 md:p-8 space-y-4 animate-fade-up stagger-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              📅 {monthLabel}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{dataLoading ? '載入中...' : `共 ${monthly.length} 筆記錄`}</p>
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--primary)' }}>
              {dataLoading ? <span className="animate-pulse">---</span> : currency(total)}
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">本月總支出</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 90%)' }}>
              <div className="text-xs text-[var(--muted-foreground)]">👥 共同支出</div>
              <div className="text-lg font-bold mt-1">{currency(sharedTotal)}</div>
            </div>
            <div className="rounded-xl bg-[var(--muted)] p-4">
              <div className="text-xs text-[var(--muted-foreground)]">👤 個人支出</div>
              <div className="text-lg font-bold mt-1">{currency(total - sharedTotal)}</div>
            </div>
            <div className="rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--muted-foreground)]">👨‍👩‍👧‍👦 成員數</div>
              <div className="text-lg font-bold mt-1">{members.length} 人</div>
            </div>
            <div className="rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--muted-foreground)]">💳 未結清</div>
              <div className="text-lg font-bold mt-1">{debts.length} 筆</div>
            </div>
          </div>
        </div>

        {/* 誰欠誰 — 左欄 */}
        <div className="card p-5 md:p-6 space-y-3 animate-fade-up stagger-2">
          <div className="flex items-center gap-2 font-semibold">💰 誰欠誰</div>
          {debts.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-[var(--muted-foreground)]">目前沒有未結清的債務</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {debts.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--destructive), transparent 90%)', color: 'var(--destructive)' }}>
                    {d.fromName}
                  </span>
                  <span className="text-[var(--muted-foreground)]">→</span>
                  <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-semibold">
                    {d.toName}
                  </span>
                  <span className="ml-auto font-bold">{currency(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右欄：最近記錄 + 家庭動態並排 */}
        <div className="space-y-4 md:space-y-6">
        <div className="card p-5 md:p-6 space-y-3 animate-fade-up stagger-3">
          <div className="flex items-center gap-2 font-semibold">📝 最近記錄</div>
          {recent.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-[var(--muted-foreground)]">還沒有任何記錄，點左下「記帳」開始！</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map((e) => (
                <div key={e.id} className="group flex items-center gap-3 py-2 rounded-lg hover:bg-[var(--muted)] px-2 -mx-2 transition-colors">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}>
                    {e.isShared ? '👥' : '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.description}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {fmtDate(toDate(e.date))} · {e.category} · {e.payerName}付
                    </div>
                  </div>
                  <div className="font-semibold text-sm">{currency(e.amount)}</div>
                  <button
                    onClick={() => router.push(`/expense/new?duplicate=${e.id}`)}
                    title="複製此筆"
                    className="md:opacity-0 md:group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-opacity text-xs flex-shrink-0"
                  >
                    📋
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 家庭動態 — 右欄最近記錄之下 */}
        <RecentActivitySection />
        </div>

      </div>
    </div>
  )
}
