'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useCategories } from '@/lib/hooks/use-categories'
import { useCurrentMember } from '@/lib/hooks/use-current-member'
import { useAuth } from '@/lib/auth'
import { addExpense, type ExpenseInput } from '@/lib/services/expense-service'
import { parseExpense } from '@/lib/services/local-expense-parser'
import { learnFromExpense, suggestCategory } from '@/lib/services/transaction-rules-service'
import { useToast } from '@/components/toast'
import { logger } from '@/lib/logger'

export function QuickAddBar() {
  const { group } = useGroup()
  const { members } = useMembers()
  const { categories } = useCategories()
  const { currentMemberId } = useCurrentMember(group?.id)
  const { user } = useAuth()
  const { addToast } = useToast()

  const [expanded, setExpanded] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const [saving, setSaving] = useState(false)

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).map((c) => c.name).slice(0, 6),
    [categories],
  )

  function handleDescriptionChange(text: string) {
    setDescription(text)
    // Clear auto-fill marker when user types (rule lookup will re-apply if matched)
    setAutoFilled(false)
    if (text.length >= 2) {
      try {
        const parsed = parseExpense(text)
        if (parsed.amount > 0 && !amount) setAmount(String(parsed.amount))
        if (parsed.category && parsed.category !== '其他') setCategory(parsed.category)
      } catch { /* ignore parse errors */ }

      // Query learned rules for category suggestion (non-blocking)
      if (group?.id) {
        suggestCategory(group.id, text)
          .then((suggested) => {
            if (suggested) {
              setCategory(suggested)
              setAutoFilled(true)
            }
          })
          .catch(() => { /* silent */ })
      }
    }
  }

  function handleCategoryClick(cat: string) {
    setCategory(cat === category ? '' : cat)
    setAutoFilled(false) // user-picked, no longer auto-filled
  }

  async function handleSave() {
    if (!group?.id || !user) return
    const amt = parseFloat(amount)
    if (!description.trim() || !Number.isFinite(amt) || amt <= 0) {
      addToast('請輸入描述和金額', 'warning')
      return
    }
    if (amt >= 100_000_000) {
      addToast('金額不能超過一億', 'warning')
      return
    }

    if (members.length === 0) {
      addToast('成員資料載入中，請稍候', 'warning')
      return
    }

    const payerId = currentMemberId ?? members[0]?.id
    const payerName = members.find((m) => m.id === payerId)?.name ?? ''
    if (!payerId) {
      addToast('找不到付款人，請先設定成員', 'warning')
      return
    }

    const equalShare = Math.round((amt / members.length) * 100) / 100
    const splits = members.map((m, i) => ({
      memberId: m.id,
      memberName: m.name,
      shareAmount: i === members.length - 1 ? amt - equalShare * (members.length - 1) : equalShare,
      paidAmount: m.id === payerId ? amt : 0,
      isParticipant: true,
    }))

    const input: ExpenseInput = {
      date: new Date(),
      description: description.trim(),
      amount: amt,
      category: category || '其他',
      isShared: true,
      splitMethod: 'equal',
      payerId,
      payerName,
      splits,
      paymentMethod: 'cash',
      receiptPaths: [],
      createdBy: user.uid,
    }

    setSaving(true)
    try {
      await addExpense(group.id, input, { id: payerId, name: payerName })
      // Learn the (description, category) pair for future auto-fill suggestions
      learnFromExpense(group.id, description.trim(), input.category).catch(() => { /* silent */ })
      addToast(`已記錄 ${description.trim()} $${amt}`, 'success')
      setDescription('')
      setAmount('')
      setCategory('')
      setAutoFilled(false)
      setExpanded(false)
    } catch (e) {
      logger.error('[QuickAdd] Failed:', e)
      addToast('記帳失敗，請重試', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!group) return null

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full card p-4 text-left text-[var(--muted-foreground)] hover:border-[var(--primary)] transition-colors cursor-text"
      >
        <span className="flex items-center gap-2">
          <span>⚡</span>
          <span>快速記帳...</span>
        </span>
      </button>
    )
  }

  return (
    <div className="card p-4 space-y-3 animate-fade-up">
      <div className="flex items-center gap-2 text-sm font-semibold">
        ⚡ 快速記帳
        <button onClick={() => setExpanded(false)} className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="午餐 150、交通 50..."
          autoFocus
          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <input
          type="number"
          inputMode="decimal"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="金額"
          className="w-24 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {/* 類別 chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {autoFilled && category && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--primary)]/10 text-[var(--primary)]"
            title="根據過去記錄自動分類"
          >
            ⚡ 自動分類
          </span>
        )}
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              cat === category
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !description.trim() || !amount}
          className="flex-1 py-2 rounded-xl text-sm font-semibold btn-primary btn-press disabled:opacity-50"
        >
          {saving ? '儲存中...' : '儲存'}
        </button>
        <Link
          href="/expense/new"
          className="px-4 py-2 rounded-xl text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors flex items-center"
        >
          更多選項
        </Link>
      </div>
    </div>
  )
}
