'use client'

import { useState } from 'react'
import { useGroup } from '@/lib/hooks/use-group'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useSettlements } from '@/lib/hooks/use-settlements'
import { useMembers } from '@/lib/hooks/use-members'
import { calculateNetBalances, simplifyDebts } from '@/lib/services/split-calculator'
import { addSettlement } from '@/lib/services/settlement-service'
import { currency, signedCurrency, toDate, fmtDateFull } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

// ── Settlement dialog ─────────────────────────────────────────

interface SettleDialogProps {
  fromName: string
  toName: string
  suggested: number
  onClose: () => void
  onConfirm: (amount: number, note: string) => Promise<void>
}

function SettleDialog({ fromName, toName, suggested, onClose, onConfirm }: SettleDialogProps) {
  const [amount, setAmount] = useState(String(suggested))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const n = Math.round(parseFloat(amount))
    if (!n || n <= 0) {
      setError('請輸入有效的金額')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm(n, note)
    } catch (e) {
      setError('儲存失敗，請重試')
      console.error('Settlement save error', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-6 space-y-4">
        <h2 className="text-lg font-bold">記錄付款</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">{fromName}</span>
          {' '}付給{' '}
          <span className="font-medium text-[var(--foreground)]">{toName}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">金額（NT$）</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              min="1"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">備注（選填）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Line Pay"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-[var(--destructive)] -mt-1">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !amount || Math.round(parseFloat(amount)) <= 0}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? '儲存中...' : '確認付款'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function SplitPage() {
  const { group, loading: groupLoading } = useGroup()
  const { expenses, loading: expLoading } = useExpenses(group?.id)
  const { settlements, loading: settlementsLoading } = useSettlements(group?.id)
  const { members, loading: membersLoading } = useMembers(group?.id)
  const { user } = useAuth()
  const nameMap = Object.fromEntries(members.map((m) => [m.id, m.name]))

  const [settling, setSettling] = useState<{
    fromId: string; fromName: string; toId: string; toName: string; amount: number
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const netBalances = calculateNetBalances(expenses, settlements)
  const debts = simplifyDebts(expenses, settlements, nameMap)

  // 所有出現過的成員 ID（union of members and expense splits）
  const expenseMemberIds = Array.from(new Set(expenses.flatMap((e) => e.splits.map((s) => s.memberId))))
  const memberIds = members.length > 0
    ? [...new Set([...members.map((m) => m.id), ...expenseMemberIds])]
    : expenseMemberIds

  async function handleSettle(amount: number, note: string) {
    if (!settling || !group) return
    await addSettlement(group.id, {
      fromMemberId: settling.fromId,
      fromMemberName: settling.fromName,
      toMemberId: settling.toId,
      toMemberName: settling.toName,
      amount,
      note: note || undefined,
      date: new Date(),
    }, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
    setSettling(null)
  }

  function copyReport() {
    const lines = debts.map((d) => `${d.fromName} → ${d.toName}：${currency(d.amount)}`)
    const text = lines.length > 0
      ? `💰 拆帳明細\n${lines.join('\n')}`
      : '目前沒有未結清的債務 🎉'
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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
          fromName={settling.fromName}
          toName={settling.toName}
          suggested={settling.amount}
          onClose={() => setSettling(null)}
          onConfirm={handleSettle}
        />
      )}

      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
        {/* 每人淨餘額 */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">💰 結算方案</div>
            <button
              onClick={copyReport}
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
            >
              {copied ? '已複製 ✓' : '複製明細'}
            </button>
          </div>

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
                      fromId: d.from, fromName: d.fromName,
                      toId: d.to, toName: d.toName,
                      amount: d.amount,
                    })}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    記錄
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 結算歷史 */}
        {settlements.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3">
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
