'use client'

import { useEffect, useRef, useState } from 'react'
import { evaluateAmountExpression } from '@/lib/amount-expression'
import { AmountChips } from '@/components/amount-chips'

interface InlineExpenseEditRowProps {
  /** Original expense — used for fallback values and cancel state. */
  expenseId: string
  initialAmount: number
  initialCategory: string
  availableCategories: readonly string[]
  /** When non-equal split, UI shows a notice that ratios will be re-scaled. */
  splitIsEqual: boolean
  onSave: (_next: { amount: number; category: string }) => Promise<void>
  onCancel: () => void
}

/**
 * Inline amount/category editor used inside the /records list (Issue #230).
 * Only exposes amount + category — other fields still require the full
 * /expense/[id] form. Saves via the passed-in onSave callback; surfaces
 * errors via throw (caller toasts).
 */
export function InlineExpenseEditRow({
  expenseId,
  initialAmount,
  initialCategory,
  availableCategories,
  splitIsEqual,
  onSave,
  onCancel,
}: InlineExpenseEditRowProps) {
  const [amount, setAmount] = useState(String(initialAmount))
  const [category, setCategory] = useState(initialCategory)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function handleSave() {
    const parsed = evaluateAmountExpression(amount)
    if (!parsed.ok || parsed.value <= 0) {
      setError('金額無效')
      return
    }
    const nextCategory = category.trim() || initialCategory
    if (parsed.value === initialAmount && nextCategory === initialCategory) {
      onCancel()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ amount: parsed.value, category: nextCategory })
    } catch {
      setError('儲存失敗，請重試')
      setSaving(false)
    }
  }

  return (
    <div
      className="card p-4 space-y-3 border-2"
      style={{ borderColor: 'var(--primary)' }}
      data-editing-id={expenseId}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-[var(--muted-foreground)]">
        快速編輯 — 只改金額 / 類別。描述、日期、分攤對象請用完整編輯。
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">金額</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">NT$</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              const r = evaluateAmountExpression(amount)
              if (r.ok) setAmount(String(r.value))
            }}
            placeholder="0 或 700+150"
            className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-12 pr-3 text-sm"
          />
        </div>
        <AmountChips value={amount} onChange={setAmount} className="mt-2" />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">類別</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm"
        >
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {/* If current category isn't in list (e.g. deactivated) keep it selectable */}
          {!availableCategories.includes(category) && category && (
            <option value={category}>{category}（已停用）</option>
          )}
        </select>
      </div>

      {!splitIsEqual && (
        <p className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] rounded p-2">
          此筆為 <strong>客製分攤</strong>，金額改變後分攤比例會自動按新金額等比縮放。
        </p>
      )}

      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-semibold btn-primary btn-press disabled:opacity-50"
        >
          {saving ? '儲存中…' : '✓ 儲存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--muted)]"
        >
          ✗ 取消
        </button>
      </div>
    </div>
  )
}
