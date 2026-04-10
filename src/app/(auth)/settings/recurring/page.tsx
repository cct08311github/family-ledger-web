'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useCategories } from '@/lib/hooks/use-categories'
import { useAuth } from '@/lib/auth'
import {
  addRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  togglePauseRecurringExpense,
  getCurrentUserId,
} from '@/lib/services/recurring-expense-service'
import { currency } from '@/lib/utils'
import type { RecurringExpense, RecurringFrequency } from '@/lib/types'
import { logger } from '@/lib/logger'
import Link from 'next/link'

// ── Constants ──────────────────────────────────────────────────

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  monthly: '每月',
  weekly: '每週',
  yearly: '每年',
}
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// ── Types ──────────────────────────────────────────────────────

interface FormState {
  description: string
  amount: string
  category: string
  frequency: RecurringFrequency
  dayOfMonth: number
  dayOfWeek: number
  monthOfYear: number
  payerId: string
  isShared: boolean
  startDate: string
  endDate: string
}

function defaultForm(firstMemberId = ''): FormState {
  const today = new Date().toISOString().split('T')[0]
  return {
    description: '',
    amount: '',
    category: '',
    frequency: 'monthly',
    dayOfMonth: 1,
    dayOfWeek: 1,
    monthOfYear: 1,
    payerId: firstMemberId,
    isShared: true,
    startDate: today,
    endDate: '',
  }
}

// ── Helpers ────────────────────────────────────────────────────

function freqDayLabel(r: RecurringExpense): string {
  if (r.frequency === 'monthly') return `${FREQ_LABELS.monthly} ${r.dayOfMonth ?? 1} 日`
  if (r.frequency === 'weekly') return `${FREQ_LABELS.weekly} 星期${DAY_NAMES[r.dayOfWeek ?? 1]}`
  if (r.frequency === 'yearly')
    return `${FREQ_LABELS.yearly} ${MONTH_NAMES[(r.monthOfYear ?? 1) - 1]} ${r.dayOfMonth ?? 1} 日`
  return FREQ_LABELS[r.frequency]
}

// ── Main page ──────────────────────────────────────────────────

export default function RecurringPage() {
  const { group } = useGroup()
  const { members } = useMembers()
  const { categories } = useCategories()
  const { user } = useAuth()

  const [items, setItems] = useState<RecurringExpense[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecurringExpense | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [saving, setSaving] = useState(false)

  // Subscribe to recurring expenses
  useEffect(() => {
    if (!group?.id) return
    const q = query(
      collection(db, 'groups', group.id, 'recurringExpenses'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringExpense))
    })
    return unsub
  }, [group?.id])

  // Set default payerId when members load
  useEffect(() => {
    if (members.length > 0 && !form.payerId) {
      setForm((f) => ({ ...f, payerId: members[0].id }))
    }
  }, [members])

  function openAdd() {
    setEditing(null)
    setForm(defaultForm(members[0]?.id ?? ''))
    setShowForm(true)
  }

  function openEdit(item: RecurringExpense) {
    setEditing(item)
    const startStr = item.startDate?.toDate().toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0]
    const endStr = item.endDate ? item.endDate.toDate().toISOString().split('T')[0] : ''
    setForm({
      description: item.description,
      amount: item.amount !== null ? String(item.amount) : '',
      category: item.category,
      frequency: item.frequency,
      dayOfMonth: item.dayOfMonth ?? 1,
      dayOfWeek: item.dayOfWeek ?? 1,
      monthOfYear: item.monthOfYear ?? 1,
      payerId: item.payerId,
      isShared: item.isShared,
      startDate: startStr,
      endDate: endStr,
    })
    setShowForm(true)
  }

  function buildSplits(payerId: string) {
    if (!form.isShared || members.length === 0) return []
    const amount = form.amount ? Number(form.amount) : 0
    const perPerson = members.length > 0 ? Math.round(amount / members.length) : 0
    const remainder = members.length > 0 ? amount - perPerson * (members.length - 1) : 0
    // Store actual currency amounts; the generator will recompute these from the template amount
    return members.map((m, i) => ({
      memberId: m.id,
      memberName: m.name,
      shareAmount: i === 0 ? remainder : perPerson,
      paidAmount: m.id === payerId ? amount : 0,
      isParticipant: true,
    }))
  }

  function getPayerName(payerId: string): string {
    return members.find((m) => m.id === payerId)?.name ?? '未知'
  }

  async function handleSave() {
    if (!form.description.trim() || !group?.id) return
    setSaving(true)
    const uid = getCurrentUserId() ?? user?.uid ?? ''
    const payerName = getPayerName(form.payerId)
    const splits = buildSplits(form.payerId)
    const input = {
      description: form.description.trim(),
      amount: form.amount ? Number(form.amount) : null,
      category: form.category || (categories[0]?.name ?? ''),
      frequency: form.frequency,
      ...(form.frequency !== 'weekly' ? { dayOfMonth: form.dayOfMonth } : {}),
      ...(form.frequency === 'weekly' ? { dayOfWeek: form.dayOfWeek } : {}),
      ...(form.frequency === 'yearly' ? { monthOfYear: form.monthOfYear } : {}),
      payerId: form.payerId,
      payerName,
      isShared: form.isShared,
      splitMethod: 'equal' as const,
      splits,
      paymentMethod: 'cash' as const,
      startDate: new Date(form.startDate),
      endDate: form.endDate ? new Date(form.endDate) : null,
      createdBy: uid,
    }

    try {
      if (editing?.id) {
        await updateRecurringExpense(group.id, editing.id, input)
      } else {
        await addRecurringExpense(group.id, input)
      }
      setShowForm(false)
    } catch (e) {
      logger.error('[Recurring] Failed to save:', e)
      alert('儲存失敗，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: RecurringExpense) {
    if (!group?.id || !item.id || !confirm(`確定刪除「${item.description}」？`)) return
    try {
      await deleteRecurringExpense(group.id, item.id)
    } catch (e) {
      logger.error('[Recurring] Failed to delete:', e)
      alert('刪除失敗，請稍後再試')
    }
  }

  async function handleTogglePause(item: RecurringExpense) {
    if (!group?.id || !item.id) return
    try {
      await togglePauseRecurringExpense(group.id, item.id, !item.isPaused)
    } catch (e) {
      logger.error('[Recurring] Failed to toggle pause:', e)
      alert('操作失敗，請稍後再試')
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          ← 設定
        </Link>
        <h1 className="text-xl font-bold flex-1">🔄 定期支出</h1>
        <button
          onClick={openAdd}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          ＋ 新增
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl opacity-30">🔄</div>
          <p className="text-[var(--muted-foreground)]">還沒有定期支出，點擊上方按鈕新增</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border bg-[var(--card)] p-4 space-y-2 transition-opacity ${
                item.isPaused ? 'opacity-60 border-[var(--border)]' : 'border-[var(--border)]'
              }`}
            >
              {/* Title row */}
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">🔁</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-snug">{item.description}</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {item.amount !== null ? currency(item.amount) : '金額待定'} ·{' '}
                    {item.isShared ? '共同分擔' : '個人支出'}
                  </div>
                </div>
                {item.isPaused && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] flex-shrink-0">
                    已暫停
                  </span>
                )}
              </div>

              {/* Frequency badge */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)',
                    color: 'var(--primary)',
                  }}
                >
                  {freqDayLabel(item)}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  付款人：{item.payerName}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleTogglePause(item)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
                >
                  {item.isPaused ? '▶ 恢復' : '⏸ 暫停'}
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
                >
                  編輯
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-xs px-3 py-1.5 rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg font-bold sticky top-0 bg-[var(--card)] pb-1">
              {editing ? '編輯定期支出' : '新增定期支出'}
            </h2>

            {/* Description */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">說明 *</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="例如：Netflix 訂閱"
                autoFocus
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                金額（留空表示每次手動輸入）
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                min={0}
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">分類</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {categories.filter((c) => c.isActive).map((c) => (
                  <option key={c.id ?? c.name} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Frequency */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">頻率</label>
              <div className="flex gap-2">
                {(['monthly', 'weekly', 'yearly'] as RecurringFrequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm({ ...form, frequency: f })}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      form.frequency === f
                        ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                        : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                  >
                    {FREQ_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Day selectors */}
            {form.frequency === 'monthly' && (
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">每月幾號</label>
                <select
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                  className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d} 號</option>
                  ))}
                </select>
              </div>
            )}

            {form.frequency === 'weekly' && (
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">星期幾</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {DAY_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>星期{name}</option>
                  ))}
                </select>
              </div>
            )}

            {form.frequency === 'yearly' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">月份</label>
                  <select
                    value={form.monthOfYear}
                    onChange={(e) => setForm({ ...form, monthOfYear: Number(e.target.value) })}
                    className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--muted-foreground)] mb-1 block">日期</label>
                  <select
                    value={form.dayOfMonth}
                    onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                    className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d} 號</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Payer */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">付款人</label>
              <select
                value={form.payerId}
                onChange={(e) => setForm({ ...form, payerId: e.target.value })}
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* isShared toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">共同分擔</div>
                <div className="text-xs text-[var(--muted-foreground)]">開啟後依人數平均分攤</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isShared: !form.isShared })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  form.isShared ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    form.isShared ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Start date */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">開始日期</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* End date (optional) */}
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">結束日期（選填）</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.description.trim() || saving}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
