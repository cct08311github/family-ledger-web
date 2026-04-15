'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchRecentLogs, type SystemLog } from '@/lib/services/log-service'
import { toDate } from '@/lib/utils'

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetchRecentLogs(100)
      .then((rows) => { if (!cancelled) setLogs(rows) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '載入失敗') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">系統日誌</h1>
        <Link href="/settings" className="text-sm text-[var(--muted-foreground)] hover:underline">
          ← 回到設定
        </Link>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        顯示您最近 100 筆 error/warn 日誌。其他使用者的日誌不會出現。
      </p>

      {loading && <div className="text-sm text-[var(--muted-foreground)]">載入中…</div>}
      {error && <div className="text-sm text-[var(--destructive)]">無法載入：{error}</div>}
      {!loading && !error && logs.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          ✨ 太好了，沒有錯誤紀錄
        </div>
      )}

      <div className="space-y-2">
        {logs.map((log) => {
          const isOpen = expanded.has(log.id)
          const badge = log.level === 'error' ? 'bg-[var(--destructive)] text-white' : 'bg-yellow-400 text-yellow-900'
          const ts = log.createdAt ? toDate(log.createdAt).toLocaleString('zh-TW', { hour12: false }) : '—'
          return (
            <div key={log.id} className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
              <button
                onClick={() => toggle(log.id)}
                className="w-full px-3 py-2.5 text-left flex items-start gap-3 hover:bg-[var(--muted)] transition"
              >
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badge}`}>
                  {log.level}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{log.message}</div>
                  <div className="text-[11px] text-[var(--muted-foreground)]">{ts}</div>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--border)] p-3 text-xs font-mono whitespace-pre-wrap break-all bg-[var(--muted)]/30">
                  {log.url && <div>url: {log.url}</div>}
                  {log.userAgent && <div className="text-[var(--muted-foreground)]">ua: {log.userAgent}</div>}
                  {log.appVersion && <div className="text-[var(--muted-foreground)]">version: {log.appVersion}</div>}
                  {log.context !== null && log.context !== undefined && (
                    <div className="mt-2">
                      {JSON.stringify(log.context, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
