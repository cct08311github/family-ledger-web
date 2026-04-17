'use client'

import { useState } from 'react'
import { pruneStaleRules, STALE_RULE_DAYS, isAuthError } from '@/lib/services/transaction-rules-service'
import { useToast } from '@/components/toast'
import { logger } from '@/lib/logger'

interface RuleCleanupSectionProps {
  groupId: string
}

/**
 * Owner-facing admin tool that prunes inactive transaction rules — rules that
 * never reached the suggestion threshold and have not been touched in
 * STALE_RULE_DAYS days. Mitigation for Issue #167 (transactionRules can't be
 * size-capped at the rules layer).
 */
export function RuleCleanupSection({ groupId }: RuleCleanupSectionProps) {
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<{
    scanned: number
    pruned: number
    kept: number
    failed: number
  } | null>(null)
  const { addToast } = useToast()

  async function handlePrune() {
    if (!confirm(`確定要清理 ${STALE_RULE_DAYS} 天以上未被使用、也沒累積到建議門檻的分類規則？\n此操作無法復原，但您日後記帳會重新學習。`)) {
      return
    }
    setRunning(true)
    try {
      const result = await pruneStaleRules(groupId)
      setLastResult(result)
      if (result.scanned === 0) {
        addToast('目前沒有分類規則', 'success')
      } else if (result.pruned === 0) {
        addToast(`掃描 ${result.scanned} 筆，沒有需要清理的規則`, 'success')
      } else {
        const msg = result.failed > 0
          ? `已清理 ${result.pruned} 筆、${result.failed} 筆失敗`
          : `已清理 ${result.pruned} 筆，保留 ${result.kept} 筆有效規則`
        addToast(msg, result.failed > 0 ? 'warning' : 'success')
      }
    } catch (e) {
      logger.error('[RuleCleanup] pruneStaleRules failed', e)
      if (isAuthError(e)) {
        addToast('權限不足，請確認您仍是群組成員', 'error')
      } else {
        addToast('清理失敗，請稍後重試', 'error')
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        智慧分類規則會在使用者重複記同樣的描述＋類別達 3 次後自動建議類別。
        但只記一、兩次沒達門檻的組合會一直累積。本工具會清理超過 {STALE_RULE_DAYS} 天沒用、
        且還沒達建議門檻的規則（已生效的規則不會被刪）。
      </p>

      <div className="flex gap-2">
        <button
          onClick={handlePrune}
          disabled={running}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          {running ? '清理中…' : '清理過期規則'}
        </button>
      </div>

      <div role="status" aria-live="polite" className="space-y-1">
        {lastResult && (
          <div className="text-xs text-[var(--muted-foreground)] space-y-0.5">
            <div>掃描：{lastResult.scanned} 筆</div>
            <div>已清理：{lastResult.pruned} 筆</div>
            <div>保留：{lastResult.kept} 筆</div>
            {lastResult.failed > 0 && (
              <div className="text-[var(--destructive)]">失敗：{lastResult.failed} 筆（可再執行一次）</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
