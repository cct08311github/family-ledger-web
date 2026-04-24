'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useGroup } from '@/lib/hooks/use-group'
import { useActivityLog } from '@/lib/hooks/use-activity-log'
import { getActivityIcon, formatRelativeTime } from '@/lib/activity-format'

const RECENT_LIMIT = 6

interface RecentActivitySectionProps {
  /** Skip card wrapper + header when embedded (e.g. inside RecentTimelineTabs). */
  noCard?: boolean
}

/**
 * Home-page feed of the group's most recent activity log entries.
 * Complements "最近記錄" (personal expense stream) with the group-level
 * timeline: who deleted, edited, settled. Closes the UX gap that a user's
 * own actions never appear in their own notifications page — actions all
 * appear here regardless of actor. Issue #201.
 */
export function RecentActivitySection({ noCard }: RecentActivitySectionProps = {}) {
  const { group } = useGroup()
  const { logs, loading } = useActivityLog(group?.id, RECENT_LIMIT)
  // `now` is held in state so relative labels re-render each minute without
  // subscribing every component to a global clock tick.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!group) return null

  const body = (
    <>
      {!noCard && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">📣 家庭動態</div>
          <Link
            href="/settings/activity-log"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            查看全部 →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
          載入中...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-2 opacity-50">📭</div>
          <p className="text-sm text-[var(--muted-foreground)]">還沒有動態</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 py-2 rounded-lg hover:bg-[var(--muted)] px-2 -mx-2 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 85%)' }}
              >
                {getActivityIcon(log.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{log.description}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {log.actorName} · {formatRelativeTime(log.createdAt, now)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return noCard ? <div className="space-y-3">{body}</div> : (
    <div className="card p-5 md:p-6 space-y-3 animate-fade-up stagger-3">{body}</div>
  )
}
