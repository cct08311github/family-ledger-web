'use client'

import { useState } from 'react'
import { scanOrphans, deleteOrphans, type OrphanFile } from '@/lib/services/orphan-scanner'
import { useToast } from '@/components/toast'
import { logger } from '@/lib/logger'

interface OrphanCleanupSectionProps {
  groupId: string
}

/** Exclude files uploaded within this window (race with in-flight uploads). */
const RECENT_CUTOFF_MS = 60 * 60 * 1000 // 1 hour

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatAge(timeCreated: string): string {
  if (!timeCreated) return '未知'
  const ageMs = Date.now() - new Date(timeCreated).getTime()
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000))
  if (days >= 1) return `${days} 天前`
  const hours = Math.floor(ageMs / (60 * 60 * 1000))
  if (hours >= 1) return `${hours} 小時前`
  const minutes = Math.floor(ageMs / (60 * 1000))
  return `${Math.max(minutes, 1)} 分鐘前`
}

export function OrphanCleanupSection({ groupId }: OrphanCleanupSectionProps) {
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [orphans, setOrphans] = useState<OrphanFile[]>([])
  const [recentSkipped, setRecentSkipped] = useState(0)
  const { addToast } = useToast()

  const totalSize = orphans.reduce((s, o) => s + o.size, 0)

  async function handleScan() {
    setScanning(true)
    try {
      const all = await scanOrphans(groupId)
      const cutoff = Date.now() - RECENT_CUTOFF_MS
      const stale: OrphanFile[] = []
      let recent = 0
      for (const o of all) {
        const t = o.timeCreated ? new Date(o.timeCreated).getTime() : 0
        if (t > cutoff) recent++
        else stale.push(o)
      }
      setOrphans(stale)
      setRecentSkipped(recent)
      setScanned(true)
      if (stale.length === 0 && recent === 0) {
        addToast('沒有發現孤兒檔', 'success')
      } else if (stale.length === 0) {
        addToast(`發現 ${recent} 個近期檔案（已保護，不列出）`, 'success')
      } else {
        addToast(`發現 ${stale.length} 個孤兒檔`, 'success')
      }
    } catch (e) {
      logger.error('[OrphanCleanup] scan failed', e)
      addToast('掃描失敗，請稍後重試', 'error')
    } finally {
      setScanning(false)
    }
  }

  async function handleDeleteAll() {
    if (orphans.length === 0) return
    if (!confirm(`確定要刪除 ${orphans.length} 個孤兒檔（${formatSize(totalSize)}）嗎？此操作無法復原。`)) {
      return
    }
    setDeleting(true)
    try {
      const paths = orphans.map((o) => o.path)
      const { succeeded, failed } = await deleteOrphans(paths)
      if (failed.length === 0) {
        addToast(`已刪除 ${succeeded.length} 個檔案`, 'success')
        setOrphans([])
      } else {
        addToast(`刪除 ${succeeded.length} 成功、${failed.length} 失敗`, 'warning')
        const failedSet = new Set(failed.map((f) => f.path))
        setOrphans((prev) => prev.filter((o) => failedSet.has(o.path)))
      }
    } catch (e) {
      logger.error('[OrphanCleanup] delete failed', e)
      addToast('刪除失敗', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        掃描 Storage 中未被任何支出引用的收據檔案（上傳後 Firestore 寫入失敗或其他中斷造成的殘留）。
        為避免誤殺正在上傳的檔案，會自動排除最近 1 小時內建立的檔案。
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleScan}
          disabled={scanning || deleting}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          {scanning ? '掃描中…' : scanned ? '重新掃描' : '掃描孤兒檔'}
        </button>
        {orphans.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'var(--destructive)' }}
          >
            {deleting ? '刪除中…' : `刪除全部（${formatSize(totalSize)}）`}
          </button>
        )}
      </div>

      {scanned && recentSkipped > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          已保護 {recentSkipped} 個近期檔案（1 小時內上傳），下次掃描會重新評估。
        </p>
      )}

      {orphans.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)] max-h-80 overflow-y-auto">
          {orphans.map((o) => (
            <div key={o.path} className="px-3 py-2 text-xs">
              <div className="font-mono text-[var(--muted-foreground)] truncate" title={o.path}>
                {o.path}
              </div>
              <div className="flex gap-3 mt-1 text-[var(--muted-foreground)]">
                <span>{formatSize(o.size)}</span>
                <span>{formatAge(o.timeCreated)}</span>
                {o.expenseId && <span className="font-mono">expense: {o.expenseId}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {scanned && orphans.length === 0 && recentSkipped === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">✅ 乾淨，沒有孤兒檔</p>
      )}
    </div>
  )
}
