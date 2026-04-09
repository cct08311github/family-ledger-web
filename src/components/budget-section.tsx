'use client'

import { useState, useEffect } from 'react'
import { useGroup } from '@/lib/hooks/use-group'
import { updateGroup } from '@/lib/services/group-service'
import { useToast } from '@/components/toast'
import { currency } from '@/lib/utils'
import { logger } from '@/lib/logger'

export function BudgetSection() {
  const { group } = useGroup()
  const { addToast } = useToast()
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync input with current budget when group loads/changes
  useEffect(() => {
    if (group?.monthlyBudget != null) {
      setInput(String(group.monthlyBudget))
    } else {
      setInput('')
    }
  }, [group?.id, group?.monthlyBudget])

  async function handleSave() {
    if (!group?.id) return
    const trimmed = input.trim()
    const value = trimmed === '' ? null : Math.round(parseFloat(trimmed))
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      addToast('預算金額必須大於 0', 'warning')
      return
    }
    setSaving(true)
    try {
      await updateGroup(group.id, { monthlyBudget: value })
      addToast(value === null ? '已清除月度預算' : `已設定月度預算 ${currency(value)}`, 'success')
    } catch (e) {
      logger.error('[Budget] Failed to update:', e)
      addToast('設定失敗，請重試', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setInput('')
    if (!group?.id) return
    setSaving(true)
    try {
      await updateGroup(group.id, { monthlyBudget: null })
      addToast('已清除月度預算', 'success')
    } catch (e) {
      logger.error('[Budget] Failed to clear:', e)
      addToast('清除失敗，請重試', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!group) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        設定每月支出預算目標，首頁會顯示進度條與超支警示。預算為整個家庭群組共享。
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)] pointer-events-none">
            NT$
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="100"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如 30000"
            className="w-full pl-11 pr-3 h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 h-11 rounded-lg text-sm font-semibold btn-primary btn-press disabled:opacity-50"
        >
          {saving ? '儲存中' : '儲存'}
        </button>
        {group.monthlyBudget != null && (
          <button
            onClick={handleClear}
            disabled={saving}
            className="px-3 h-11 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            清除
          </button>
        )}
      </div>
      {group.monthlyBudget != null && (
        <div className="text-xs text-[var(--muted-foreground)]">
          目前設定：{currency(group.monthlyBudget)} / 月
        </div>
      )}
    </div>
  )
}
