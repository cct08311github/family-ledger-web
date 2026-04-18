'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/components/toast'
import { logger } from '@/lib/logger'
import {
  getEmailNotificationEnabled,
  setEmailNotificationEnabled,
} from '@/lib/services/user-preference-service'

interface Props {
  groupId: string
}

/**
 * Per-group opt-in toggle for email notifications (Issue #187).
 * Flips userPreferences.emailEnabled and caches the Firebase Auth email so the
 * notify pipeline can reach the user without an admin-SDK lookup.
 */
export function EmailPreferenceSection({ groupId }: Props) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getEmailNotificationEnabled(groupId)
      .then((v) => {
        if (!cancelled) setEnabled(v)
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  async function toggle(next: boolean) {
    if (saving) return
    setSaving(true)
    try {
      await setEmailNotificationEnabled(groupId, next)
      setEnabled(next)
      addToast(next ? '已開啟 Email 通知' : '已關閉 Email 通知', 'success')
    } catch (e) {
      logger.error('[EmailPreference] Failed to toggle', e)
      addToast('設定失敗，請稍後再試', 'error')
    } finally {
      setSaving(false)
    }
  }

  const displayEmail = user?.email ?? '（未提供 email）'
  const hasEmail = !!user?.email

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        開啟後，本群組其他成員新增/編輯/刪除支出或結算時，系統會寄送 email 到
        下方信箱。您自己的動作不會寄給您自己。
      </p>

      <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)]">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--muted-foreground)]">收件信箱</div>
          <div className="text-sm font-mono truncate" title={displayEmail}>{displayEmail}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          disabled={saving || enabled === null || !hasEmail}
          onClick={() => toggle(!enabled)}
          className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {!hasEmail && (
        <p className="text-xs text-[var(--destructive)]">
          您的 Firebase Auth 帳號沒有 email，無法開啟此功能。
        </p>
      )}
    </div>
  )
}
