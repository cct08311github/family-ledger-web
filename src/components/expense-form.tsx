'use client'

import { useState, useEffect, type RefObject } from 'react'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useCategories } from '@/lib/hooks/use-categories'
import { addExpense, updateExpense, type ExpenseInput } from '@/lib/services/expense-service'
import { learnFromExpense, suggestCategory } from '@/lib/services/transaction-rules-service'
import { useAuth } from '@/lib/auth'
import { toDate } from '@/lib/utils'
import type { Expense, SplitMethod, PaymentMethod, SplitDetail } from '@/lib/types'
import type { ParsedExpense } from '@/lib/services/local-expense-parser'

const FALLBACK_CATEGORIES = ['餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他']

interface Props {
  existingExpense?: Expense
  duplicateFrom?: Expense
  onSaved: () => void
  /** Ref to register a setter for voice-parsed results. Parent passes ref, form fills it on mount. */
  onVoiceParsedRef?: RefObject<((_result: ParsedExpense) => void) | null>
}

export function ExpenseForm({ existingExpense, duplicateFrom, onSaved, onVoiceParsedRef }: Props) {
  const { group } = useGroup()
  const { members } = useMembers()
  const { expenses } = useExpenses()
  const { categories: firestoreCategories } = useCategories()
  const categoryList = firestoreCategories.length > 0
    ? firestoreCategories.filter((c) => c.isActive).map((c) => c.name)
    : FALLBACK_CATEGORIES
  const { user } = useAuth()
  const isEditing = !!existingExpense

  const source = existingExpense ?? duplicateFrom

  const [date, setDate] = useState(() => {
    if (source && !duplicateFrom) return toDate(source.date).toISOString().split('T')[0]
    return new Date().toISOString().split('T')[0]
  })
  const [description, setDescription] = useState(source?.description ?? '')
  const [amount, setAmount] = useState(source?.amount?.toString() ?? '')
  const [category, setCategory] = useState(source?.category ?? '餐飲')
  const [isShared, setIsShared] = useState(source?.isShared ?? true)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(source?.splitMethod ?? 'equal')
  const [payerId, setPayerId] = useState(source?.payerId ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(source?.paymentMethod ?? 'cash')
  const [note, setNote] = useState(source?.note ?? '')
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set())
  const [percentages, setPercentages] = useState<Record<string, number>>({})
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoCategoryFilled, setAutoCategoryFilled] = useState(false)

  // 語音解析回填：父元件透過 ref 呼叫此函數填入欄位
  useEffect(() => {
    if (!onVoiceParsedRef) return
    onVoiceParsedRef.current = (result: ParsedExpense) => {
      if (result.description) setDescription(result.description)
      if (result.amount > 0) setAmount(String(result.amount))
      if (result.date) setDate(result.date)
      if (result.category && categoryList.includes(result.category)) setCategory(result.category)
    }
    return () => { onVoiceParsedRef.current = null }
  }, [onVoiceParsedRef, categoryList])

  // 最近描述（自動完成）
  const recentDescs = [...new Set(expenses.map((e) => e.description))].slice(0, 20)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const filteredDescs = description
    ? recentDescs.filter((d) => d.toLowerCase().includes(description.toLowerCase())).slice(0, 5)
    : recentDescs.slice(0, 5)

  // 智能分類建議：描述變更時查詢學習到的規則（僅新增模式，不影響編輯）
  useEffect(() => {
    if (isEditing || !group?.id || description.trim().length < 2) {
      setAutoCategoryFilled(false)
      return
    }
    const trimmed = description.trim()
    const handle = setTimeout(() => {
      suggestCategory(group.id, trimmed)
        .then((suggested) => {
          if (suggested && categoryList.includes(suggested)) {
            setCategory(suggested)
            setAutoCategoryFilled(true)
          }
        })
        .catch(() => { /* silent */ })
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, group?.id, isEditing])

  // 初始化參與者和付款人
  useEffect(() => {
    if (members.length === 0) return
    // Set payerId if empty OR if current payerId is no longer valid (member was removed)
    const payerValid = members.some((m) => m.id === payerId)
    if (!payerId || !payerValid) setPayerId(members[0].id)
    if (participantIds.size === 0) {
      if (source?.splits) {
        setParticipantIds(new Set(source.splits.filter((s) => s.isParticipant).map((s) => s.memberId)))
        if (source.splitMethod === 'percentage') {
          const total = source.amount
          const pcts: Record<string, number> = {}
          for (const s of source.splits.filter((s) => s.isParticipant)) {
            pcts[s.memberId] = total > 0 ? Math.round(s.shareAmount / total * 100) : 0
          }
          setPercentages(pcts)
        }
        if (source.splitMethod === 'custom') {
          const customs: Record<string, number> = {}
          for (const s of source.splits.filter((s) => s.isParticipant)) {
            customs[s.memberId] = s.shareAmount
          }
          setCustomAmounts(customs)
        }
      } else {
        setParticipantIds(new Set(members.map((m) => m.id)))
      }
    }
  }, [members, source, payerId, participantIds.size])

  const buildSplits = (): SplitDetail[] => {
    const amt = parseFloat(amount) || 0
    const participants = members.filter((m) => participantIds.has(m.id))
    if (participants.length === 0) return []
    const nameMap = Object.fromEntries(members.map((m) => [m.id, m.name]))

    return participants.map((m, i) => {
      let share: number
      if (splitMethod === 'equal') {
        const per = Math.round(amt / participants.length)
        const remainder = amt - per * participants.length
        share = i === participants.length - 1 ? per + remainder : per
      } else if (splitMethod === 'percentage') {
        share = Math.round(amt * (percentages[m.id] ?? 0) / 100)
        // Distribute rounding remainder to last participant to ensure sum matches amount
        if (i === participants.length - 1) {
          const total = participants.reduce((s, pm) => s + Math.round(amt * (percentages[pm.id] ?? 0) / 100), 0)
          share += amt - total
        }
      } else {
        share = customAmounts[m.id] ?? 0
      }
      return {
        memberId: m.id,
        memberName: nameMap[m.id] ?? '',
        shareAmount: share,
        paidAmount: m.id === payerId ? amt : 0,
        isParticipant: true,
      }
    })
  }

  const handleSave = async () => {
    if (!group?.id || !description.trim() || !amount || !payerId) {
      setError('請填寫必要欄位')
      return
    }
    const saveAmt = parseFloat(amount)
    if (!saveAmt || saveAmt <= 0) {
      setError('金額必須大於 0')
      return
    }
    const splits = isShared ? buildSplits() : []
    if (isShared && splitMethod !== 'equal') {
      const splitSum = splits.reduce((s, sp) => s + sp.shareAmount, 0)
      if (splitSum !== saveAmt) {
        setError(`分帳金額合計 (NT$ ${splitSum}) 與支出金額 (NT$ ${saveAmt}) 不符`)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const input: ExpenseInput = {
        date: new Date(date),
        description: description.trim(),
        amount: saveAmt,
        category,
        isShared,
        splitMethod,
        payerId,
        payerName: members.find((m) => m.id === payerId)?.name ?? '',
        splits,
        paymentMethod,
        receiptPaths: [],
        note: note.trim() || undefined,
        createdBy: user?.uid ?? payerId,
      }
      if (isEditing) {
        await updateExpense(group.id, existingExpense!.id, input, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
      } else {
        await addExpense(group.id, input, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
      }
      // Learn from this save to improve future auto-categorization
      learnFromExpense(group.id, input.description, input.category).catch(() => { /* silent */ })
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const amt = parseFloat(amount) || 0
  const pCount = participantIds.size || 1

  // Compute derived values for real-time indicators
  const percentParticipants = members.filter((m) => participantIds.has(m.id))
  const percentTotal = percentParticipants.reduce((s, m) => s + (percentages[m.id] ?? 0), 0)
  const customParticipants = members.filter((m) => participantIds.has(m.id))
  const customTotal = customParticipants.reduce((s, m) => s + (customAmounts[m.id] ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* 日期 */}
      <div>
        <label className="text-sm font-medium mb-1 block">日期</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
      </div>

      {/* 描述（含自動完成） */}
      <div className="relative">
        <label className="text-sm font-medium mb-1 block">描述</label>
        <input type="text" value={description} placeholder="例如：晚餐、加油、水費..."
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
        {showSuggestions && filteredDescs.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
            {filteredDescs.map((d) => (
              <button key={d} className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] transition"
                onMouseDown={() => { setDescription(d); setShowSuggestions(false) }}>
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 金額 */}
      <div>
        <label className="text-sm font-medium mb-1 block">金額</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">NT$</span>
          <input type="number" inputMode="decimal" min="1" step="1" value={amount} placeholder="0"
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] pl-12 pr-3 text-sm" />
        </div>
      </div>

      {/* 類別 */}
      <div>
        <label className="text-sm font-medium mb-1 flex items-center gap-2">
          類別
          {autoCategoryFilled && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--primary)]/10 text-[var(--primary)]"
              title="根據過去記錄自動分類，你可以手動修改"
            >
              ⚡ 自動分類
            </span>
          )}
        </label>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setAutoCategoryFilled(false) }}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          {categoryList.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 付款方式 */}
      <div>
        <label className="text-sm font-medium mb-1 block">付款方式</label>
        <div className="flex gap-2">
          {([['cash', '💵 現金'], ['creditCard', '💳 信用卡']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPaymentMethod(v)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border transition ${
                paymentMethod === v
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[var(--border)] hover:bg-[var(--muted)]'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 支出類型 */}
      <div>
        <label className="text-sm font-medium mb-1 block">支出類型</label>
        <div className="flex gap-2">
          {[{ v: false, l: '👤 個人支出' }, { v: true, l: '👥 共同支出' }].map(({ v, l }) => (
            <button key={String(v)} onClick={() => setIsShared(v)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border transition ${
                isShared === v
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[var(--border)] hover:bg-[var(--muted)]'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 付款人 */}
      <div>
        <label className="text-sm font-medium mb-1 block">付款人</label>
        <select value={payerId} onChange={(e) => setPayerId(e.target.value)}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* 分帳設定 */}
      {isShared && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <label className="text-sm font-medium block">分帳方式</label>
          <div className="flex gap-2">
            {([['equal', '均分'], ['percentage', '比例'], ['custom', '自訂']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setSplitMethod(v)}
                className={`flex-1 h-9 rounded-lg text-sm font-medium border transition ${
                  splitMethod === v
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border-[var(--border)] hover:bg-[var(--muted)]'
                }`}>{l}</button>
            ))}
          </div>

          {/* 參與者 */}
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const selected = participantIds.has(m.id)
              return (
                <button key={m.id} onClick={() => {
                  const next = new Set(participantIds)
                  if (selected && next.size > 1) next.delete(m.id); else next.add(m.id)
                  setParticipantIds(next)
                }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]'
                  }`}>{m.name}</button>
              )
            })}
          </div>

          {/* 比例輸入 */}
          {splitMethod === 'percentage' && (
            <>
              {percentParticipants.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-16 text-sm">{m.name}</span>
                  <input type="number" placeholder="%" value={percentages[m.id] ?? ''}
                    onChange={(e) => setPercentages({ ...percentages, [m.id]: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                    className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
                  <span className="text-xs text-[var(--muted-foreground)]">%</span>
                </div>
              ))}
              <div className={`text-xs ${percentTotal !== 100 ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}`}>
                目前合計: {percentTotal}%{percentTotal !== 100 ? ' （須等於 100%）' : ''}
              </div>
            </>
          )}

          {/* 自訂金額輸入 */}
          {splitMethod === 'custom' && (
            <>
              {customParticipants.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-16 text-sm">{m.name}</span>
                  <input type="number" placeholder="NT$" value={customAmounts[m.id] ?? ''}
                    onChange={(e) => setCustomAmounts({ ...customAmounts, [m.id]: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
                </div>
              ))}
              <div className={`text-xs ${amt > 0 && customTotal !== amt ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}`}>
                已分配 NT$ {customTotal} / NT$ {amt}{amt > 0 && customTotal !== amt ? ' （總和須等於支出金額）' : ''}
              </div>
            </>
          )}

          {/* 預覽 */}
          {amt > 0 && (
            <div className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 90%)' }}>
              <div className="font-medium">拆帳預覽</div>
              {splitMethod === 'equal' && <div>每人 NT$ {Math.round(amt / pCount)}（共 {pCount} 人）</div>}
              {splitMethod === 'percentage' && percentParticipants.map((m) => (
                <div key={m.id}>{m.name}：{percentages[m.id] ?? 0}% = NT$ {Math.round(amt * (percentages[m.id] ?? 0) / 100)}</div>
              ))}
              {splitMethod === 'custom' && customParticipants.map((m) => (
                <div key={m.id}>{m.name}：NT$ {customAmounts[m.id] ?? 0}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 備註 */}
      <div>
        <label className="text-sm font-medium mb-1 block">備註（可選）</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="備註..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm resize-none" />
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}

      {/* 儲存 */}
      <button onClick={handleSave} disabled={saving}
        className="w-full h-12 rounded-xl font-semibold btn-primary btn-press">
        {saving ? '儲存中...' : isEditing ? '儲存變更' : '新增支出'}
      </button>
    </div>
  )
}
