'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useCategories } from '@/lib/hooks/use-categories'
import { useCurrentMember } from '@/lib/hooks/use-current-member'
import { useExpenses, useRecentExpenses } from '@/lib/hooks/use-expenses'
import { useAuth } from '@/lib/auth'
import { addExpense, type ExpenseInput } from '@/lib/services/expense-service'
import { parseExpense } from '@/lib/services/local-expense-parser'
import { learnFromExpense, suggestCategory, isAuthError } from '@/lib/services/transaction-rules-service'
import { useToast } from '@/components/toast'
import { useSubmitGuard } from '@/lib/hooks/use-submit-guard'
import { buildDraftKey, parseDraft, serializeDraft } from '@/lib/quick-add-draft'
import { buildDuplicateHref } from '@/lib/quick-add-duplicate'
import { evaluateAmountExpression } from '@/lib/amount-expression'
import { AmountChips } from '@/components/amount-chips'
import { logger } from '@/lib/logger'

export function QuickAddBar() {
  const { group } = useGroup()
  const { members } = useMembers()
  const { categories } = useCategories()
  const { currentMemberId } = useCurrentMember(group?.id)
  const { expenses } = useExpenses()
  const { user } = useAuth()
  const { addToast } = useToast()

  const [lastExpense] = useRecentExpenses(expenses, 1)
  const duplicateHref = buildDuplicateHref(lastExpense?.id)

  const [expanded, setExpanded] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const { inFlight: saving, run: runSubmit } = useSubmitGuard()

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).map((c) => c.name).slice(0, 6),
    [categories],
  )

  const draftKey = buildDraftKey(group?.id, user?.uid)

  function clearDraftFor(key: string | null) {
    if (!key || typeof window === 'undefined') return
    try { sessionStorage.removeItem(key) } catch { /* ignore */ }
  }
  function clearDraft() {
    clearDraftFor(draftKey)
  }

  // Restore on mount / when group/user change. If a valid unexpired draft
  // exists, auto-expand the bar and populate the fields — the user was
  // clearly mid-entry before navigating away. ExpenseForm uses a banner
  // because its form is long; QuickAddBar is small enough that auto-restore
  // is friendlier than adding a restore prompt. Issue #199.
  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return
      const parsed = parseDraft(raw, Date.now())
      if (!parsed) {
        clearDraftFor(draftKey)
        return
      }
      setDescription(parsed.description)
      setAmount(parsed.amount)
      setCategory(parsed.category)
      setExpanded(true)
    } catch {
      clearDraftFor(draftKey)
    }
  }, [draftKey])

  // Autosave (debounced). When all content is cleared, actively drop the old
  // draft so a stale (but TTL-live) copy doesn't resurrect on next mount.
  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return
    if (!description.trim() && !amount) {
      clearDraftFor(draftKey)
      return
    }
    const handle = setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftKey,
          serializeDraft({
            description,
            amount,
            category,
            savedAt: Date.now(),
          }),
        )
      } catch { /* quota exceeded — silent */ }
    }, 500)
    return () => clearTimeout(handle)
  }, [draftKey, description, amount, category])

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
          .catch((e) => {
            // Auth errors (PERMISSION_DENIED / UNAUTHENTICATED) surface as toast —
            // the user likely needs to re-auth or has lost group membership. Other
            // errors remain silent (best-effort suggestion). Issue #164.
            if (isAuthError(e)) {
              logger.error('[QuickAdd] suggestCategory auth error', e)
              addToast('登入狀態失效，請重新整理或重新登入', 'error')
            }
          })
      }
    }
  }

  function handleCategoryClick(cat: string) {
    setCategory(cat === category ? '' : cat)
    setAutoFilled(false) // user-picked, no longer auto-filled
  }

  async function handleSave() {
    if (!group?.id || !user) return
    if (!description.trim()) {
      addToast('請輸入描述', 'warning')
      return
    }
    const parsed = evaluateAmountExpression(amount)
    if (!parsed.ok || parsed.value <= 0) {
      addToast('金額無效，請檢查輸入', 'warning')
      return
    }
    const amt = parsed.value
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

    // Guard acquired here, inside runSubmit. All earlier validation is sync,
    // so the guard's tryAcquire() runs before this handler yields — second
    // clicks arrive after the sync run() body has already flipped the flag.
    // If future changes insert any await between the click entry and this
    // runSubmit call, move the guard earlier.
    await runSubmit(async () => {
      try {
        await addExpense(group.id, input, { id: payerId, name: payerName })
        // Learn the (description, category) pair for future auto-fill suggestions.
        // Non-fatal by design — except for auth errors, which surface to the user
        // so they can re-authenticate (Issue #164).
        learnFromExpense(group.id, description.trim(), input.category).catch((e) => {
          if (isAuthError(e)) {
            logger.error('[QuickAdd] learnFromExpense auth error', e)
            addToast('登入狀態失效，規則學習已停止', 'warning')
          }
        })
        addToast(`已記錄 ${description.trim()} $${amt}`, 'success')
        clearDraft()
        setDescription('')
        setAmount('')
        setCategory('')
        setAutoFilled(false)
        setExpanded(false)
      } catch (e) {
        logger.error('[QuickAdd] Failed:', e)
        addToast('記帳失敗，請重試', 'error')
      }
    })
  }

  if (!group) return null

  if (!expanded) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setExpanded(true)}
          className="flex-1 card p-4 text-left text-[var(--muted-foreground)] hover:border-[var(--primary)] transition-colors cursor-text"
        >
          <span className="flex items-center gap-2">
            <span>⚡</span>
            <span>快速記帳...</span>
          </span>
        </button>
        {duplicateHref ? (
          <Link
            href={duplicateHref}
            aria-label="複製最近一筆支出"
            title="複製最近一筆支出"
            className="card px-4 flex items-center justify-center text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)] transition-colors whitespace-nowrap"
          >
            ↺ 同上筆
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-label="尚無可複製的支出"
            title="尚無可複製的支出"
            className="card px-4 flex items-center justify-center text-sm text-[var(--muted-foreground)] opacity-40 cursor-not-allowed whitespace-nowrap"
          >
            ↺ 同上筆
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3 animate-fade-up">
      <div className="flex items-center gap-2 text-sm font-semibold">
        ⚡ 快速記帳
        <button
          onClick={() => {
            // Close and discard the draft; user's intent is to abandon this
            // entry. (Auto-restore on next mount would otherwise re-open the bar.)
            clearDraft()
            setDescription('')
            setAmount('')
            setCategory('')
            setAutoFilled(false)
            setExpanded(false)
          }}
          aria-label="關閉快速記帳"
          className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ✕
        </button>
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
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const r = evaluateAmountExpression(amount)
            if (r.ok) setAmount(String(r.value))
          }}
          placeholder="金額"
          className="w-28 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {/* 金額快捷 chips — 允許 700+150 直接輸入也支援 */}
      <AmountChips value={amount} onChange={setAmount} />

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
