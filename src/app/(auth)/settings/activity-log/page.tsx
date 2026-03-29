'use client'

import { useGroup } from '@/lib/hooks/use-group'
import { useActivityLog } from '@/lib/hooks/use-activity-log'
import { toDate, fmtDateFull } from '@/lib/utils'

const ACTION_ICONS: Record<string, string> = {
  expense_created: '💸',
  expense_updated: '✏️',
  expense_deleted: '🗑️',
  settlement_created: '✅',
  member_added: '👤',
  member_removed: '👤',
  category_created: '📂',
  category_updated: '✏️',
  category_deleted: '🗑️',
}

export default function ActivityLogPage() {
  const { group, loading: groupLoading } = useGroup()
  const logs = useActivityLog(group?.id)

  if (groupLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">操作記錄</h1>

      {logs.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="text-4xl opacity-30">📋</div>
          <p className="text-[var(--muted-foreground)]">還沒有操作記錄</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}>
                {ACTION_ICONS[log.action] ?? '📌'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{log.description}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {log.actorName} · {fmtDateFull(toDate(log.createdAt))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
