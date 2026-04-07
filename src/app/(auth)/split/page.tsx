'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useSettlements } from '@/lib/hooks/use-settlements'
import { useMembers } from '@/lib/hooks/use-members'
import { calculateNetBalances, simplifyDebts } from '@/lib/services/split-calculator'
import { addSettlement, deleteSettlement } from '@/lib/services/settlement-service'
import { currency, signedCurrency, toDate, fmtDateFull } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

import { logger } from '@/lib/logger'

// ── Settlement dialog ─────────────────────────────────────────

interface SettleDialogProps {
  members: { id: string; name: string }[]
  defaultFromId?: string
  defaultToId?: string
  defaultAmount?: number
  onClose: () => void
  onConfirm: (_data: { fromId: string; toId: string; amount: number; note: string; date: Date }) => Promise<void>
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function SettleDialog({ members, defaultFromId, defaultToId, defaultAmount, onClose, onConfirm }: SettleDialogProps) {
  const [dateStr, setDateStr] = useState(todayStr)
  const [fromId, setFromId] = useState(defaultFromId ?? members[0]?.id ?? '')
  const [toId, setToId] = useState(defaultToId ?? members[1]?.id ?? '')
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (fromId === toId) { setError('轉出人與轉入人不能相同'); return }
    const n = Math.round(parseFloat(amount))
    if (!n || n <= 0) { setError('請輸入有效的金額'); return }
    setSaving(true)
    setError(null)
    try {
      const [y, m, d] = dateStr.split('-').map(Number)
      await onConfirm({ fromId, toId, amount: n, note, date: new Date(y, m - 1, d) })
    } catch (e) {
      setError('儲存失敗，請重試')
      logger.error('Settlement save error', e)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm transition-all"

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 modal-backdrop animate-fade-in">
      <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 pb-24 sm:pb-6 space-y-4 animate-slide-up" style={{ boxShadow: 'var(--card-shadow-hover)' }}>
        <h2 className="text-lg font-bold">記錄轉帳</h2>

        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">日期</label>
          <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">轉出人</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputCls}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">轉入人</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputCls}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">金額（NT$）</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} min="1" placeholder="0" />
        </div>

        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">備註（可選）</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：房租、紅包..." className={inputCls} />
        </div>

        {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] btn-press transition-colors">取消</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !amount || !fromId || !toId}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold btn-primary btn-press"
          >
            {saving ? '儲存中...' : '確認'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function SplitPage() {
  const searchParams = useSearchParams()
  const { group, loading: groupLoading } = useGroup()
  const { expenses, loading: expLoading } = useExpenses(group?.id)
  const { settlements, loading: settlementsLoading } = useSettlements(group?.id)
  const { members, loading: membersLoading } = useMembers(group?.id)
  const { user } = useAuth()
  const nameMap = Object.fromEntries(members.map((m) => [m.id, m.name]))

  const [settling, setSettling] = useState<{
    fromId?: string; toId?: string; amount?: number
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Auto-open transfer dialog when navigated with ?action=transfer (once only)
  const transferTriggered = useRef(false)
  useEffect(() => {
    if (searchParams.get('action') === 'transfer' && !transferTriggered.current) {
      transferTriggered.current = true
      setSettling({})
    }
  }, [searchParams])

  async function handleDeleteSettlement(id: string) {
    if (!group) return
    const settlement = settlements.find(s => s.id === id)
    const desc = settlement
      ? `${settlement.fromMemberName} → ${settlement.toMemberName}（${currency(settlement.amount)}）`
      : '此結算紀錄'
    if (!confirm(`確定要刪除${desc}嗎？刪除後將影響債務計算。`)) return
    setDeletingId(id)
    try {
      await deleteSettlement(group.id, id, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
    } catch (e) {
      logger.error('[SplitPage] Failed to delete settlement:', e)
    } finally {
      setDeletingId(null)
    }
  }

  const netBalances = calculateNetBalances(expenses, settlements)
  const debts = simplifyDebts(expenses, settlements, nameMap)

  // 所有出現過的成員 ID（union of members and expense splits）
  const expenseMemberIds = Array.from(new Set(expenses.flatMap((e) => e.splits.map((s) => s.memberId))))
  const memberIds = members.length > 0
    ? [...new Set([...members.map((m) => m.id), ...expenseMemberIds])]
    : expenseMemberIds

  async function handleSettle(data: { fromId: string; toId: string; amount: number; note: string; date: Date }) {
    if (!group) return
    await addSettlement(group.id, {
      fromMemberId: data.fromId,
      fromMemberName: nameMap[data.fromId] ?? data.fromId,
      toMemberId: data.toId,
      toMemberName: nameMap[data.toId] ?? data.toId,
      amount: data.amount,
      note: data.note || undefined,
      date: data.date,
    }, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
    setSettling(null)
  }

  function buildShareText() {
    const today = new Date()
    const dateLabel = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`
    const groupName = group?.name ?? '家計本'

    const balanceLines = memberIds.map((id) => {
      const bal = Math.round(netBalances[id] ?? 0)
      const name = nameMap[id] ?? id
      if (bal === 0) return `  ${name}：±0（已結清）`
      return `  ${name}：${signedCurrency(bal)}（${bal > 0 ? '應收' : '應付'}）`
    })

    const debtLines = debts.map((d) => `  ${d.fromName} → ${d.toName}：${currency(d.amount)}`)

    const sections = [
      `📊 ${groupName} — ${dateLabel}`,
      '',
      '👥 每人餘額',
      ...balanceLines,
    ]

    if (debtLines.length > 0) {
      sections.push('', '💰 結算方案', ...debtLines)
    } else {
      sections.push('', '🎉 目前沒有未結清的債務')
    }

    return sections.join('\n')
  }

  async function shareReport() {
    const text = buildShareText()
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // 使用者取消分享，fallback 到複製
      }
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (groupLoading || expLoading || membersLoading || settlementsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-6xl opacity-30">💸</div>
        <h2 className="text-xl font-bold">尚未加入群組</h2>
        <p className="text-[var(--muted-foreground)]">請先到設定新增家庭成員</p>
      </div>
    )
  }

  return (
    <>
      {settling && (
        <SettleDialog
          members={members}
          defaultFromId={settling.fromId}
          defaultToId={settling.toId}
          defaultAmount={settling.amount}
          onClose={() => setSettling(null)}
          onConfirm={handleSettle}
        />
      )}

      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* 操作按鈕 */}
        <div className="flex gap-2 animate-fade-up">
          <button
            onClick={() => setSettling({})}
            className="flex-1 rounded-2xl border border-dashed border-[var(--border)] py-3 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)] btn-press transition-all"
          >
            + 記錄轉帳
          </button>
          <button
            onClick={shareReport}
            className="rounded-2xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)] btn-press transition-all"
          >
            {copied ? '已複製 ✓' : '📤 分享'}
          </button>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

        {/* 每人淨餘額 */}
        <div className="card p-5 space-y-3 animate-fade-up stagger-1">
          <div className="flex items-center justify-between">
            <div className="font-semibold">📊 每人餘額</div>
            <span className="text-xs text-[var(--muted-foreground)]">{expenses.length} 筆支出</span>
          </div>

          {memberIds.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">還沒有支出記錄</p>
          ) : (
            <div className="space-y-2">
              {memberIds.map((id) => {
                const bal = Math.round(netBalances[id] ?? 0)
                const name = nameMap[id] ?? id
                const isPositive = bal > 0
                const isNeutral = bal === 0
                return (
                  <div key={id} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        backgroundColor: 'color-mix(in oklch, var(--primary), transparent 80%)',
                        color: 'var(--primary)',
                      }}
                    >
                      {name.slice(0, 1)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {isNeutral ? '已結清' : isPositive ? '應收款' : '應付款'}
                      </div>
                    </div>
                    <div
                      className="font-semibold text-sm"
                      style={{
                        color: isNeutral
                          ? 'var(--muted-foreground)'
                          : isPositive
                          ? 'var(--primary)'
                          : 'var(--destructive)',
                      }}
                    >
                      {isNeutral ? '±0' : signedCurrency(bal)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 簡化結算方案 */}
        <div className="card p-5 space-y-3 animate-fade-up stagger-2">
          <div className="font-semibold">💰 結算方案</div>

          {debts.length === 0 ? (
            <div className="text-center py-4 space-y-1">
              <div className="text-2xl">🎉</div>
              <p className="text-sm text-[var(--muted-foreground)]">目前沒有未結清的債務</p>
            </div>
          ) : (
            <div className="space-y-2">
              {debts.map((d) => (
                <div
                  key={`${d.from}-${d.to}`}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--muted), transparent 30%)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium px-2 py-0.5 rounded-md text-xs"
                        style={{ backgroundColor: 'color-mix(in oklch, var(--destructive), transparent 85%)', color: 'var(--destructive)' }}>
                        {d.fromName}
                      </span>
                      <span className="text-[var(--muted-foreground)]">→</span>
                      <span className="font-medium px-2 py-0.5 rounded-md text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {d.toName}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-0.5 ml-0.5">轉帳</div>
                  </div>
                  <div className="font-bold">{currency(d.amount)}</div>
                  <button
                    onClick={() => setSettling({
                      fromId: d.from, toId: d.to, amount: d.amount,
                    })}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold btn-primary btn-press"
                  >
                    記錄
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>{/* end grid */}

        {/* 結算歷史 */}
        {settlements.length > 0 && (
          <div className="card p-5 space-y-3 animate-fade-up stagger-3">
            <div className="font-semibold">🧾 結算紀錄</div>
            <div className="space-y-2">
              {settlements.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    ✓
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {s.fromMemberName} → {s.toMemberName}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {fmtDateFull(toDate(s.date))}{s.note ? ` · ${s.note}` : ''}
                    </div>
                  </div>
                  <div className="font-semibold text-sm text-green-600 dark:text-green-400">
                    {currency(s.amount)}
                  </div>
                  <button
                    onClick={() => handleDeleteSettlement(s.id)}
                    disabled={deletingId === s.id}
                    className="shrink-0 text-xs px-2 py-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors disabled:opacity-50"
                  >
                    {deletingId === s.id ? '...' : '刪除'}
                  </button>
                </div>
              ))}
              {settlements.length > 10 && (
                <p className="text-xs text-[var(--muted-foreground)] text-center pt-1">
                  還有 {settlements.length - 10} 筆歷史記錄
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
