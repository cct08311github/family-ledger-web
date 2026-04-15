'use client'

import { useEffect, useState } from 'react'
import { ref as storageRef, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { logger } from '@/lib/logger'

interface Props {
  paths: string[]
  onClose: () => void
}

/**
 * Full-screen modal that resolves Firebase Storage download URLs for a set of
 * receipt paths and displays them. Supports swipe-like prev/next navigation
 * via tap zones and keyboard arrows on desktop.
 */
// `undefined` = still loading, `null` = load failed, string = loaded URL
type UrlState = string | null | undefined

export function ReceiptGallery({ paths, onClose }: Props) {
  const [urls, setUrls] = useState<UrlState[]>(() => paths.map(() => undefined))
  const [index, setIndex] = useState(0)
  const [imgError, setImgError] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    Promise.all(
      paths.map(async (p) => {
        try {
          return await getDownloadURL(storageRef(storage, p))
        } catch (err) {
          logger.error('[ReceiptGallery] Failed to get download URL', { path: p, err })
          return null
        }
      }),
    ).then((resolved) => {
      if (!cancelled) setUrls(resolved)
    })
    return () => { cancelled = true }
  }, [paths])

  function handleImgError(idx: number, url: string) {
    logger.error('[ReceiptGallery] <img> failed to render', {
      path: paths[idx],
      downloadUrl: url,
    })
    setImgError((prev) => new Set(prev).add(idx))
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(paths.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, paths.length])

  if (paths.length === 0) return null
  const currentUrl = urls[index]
  const isLoading = currentUrl === undefined
  const hasFailed = currentUrl === null || imgError.has(index)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="收據圖片檢視"
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium">
          {index + 1} / {paths.length}
        </span>
        <button
          onClick={onClose}
          aria-label="關閉"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 text-2xl"
        >
          ✕
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <div className="text-white text-sm flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            載入中…
          </div>
        ) : hasFailed ? (
          <div className="text-white/70 text-sm text-center">
            ⚠ 無法載入此圖片<br />
            <span className="text-xs">錯誤已記錄到系統日誌</span>
          </div>
        ) : (
          <img
            src={currentUrl as string}
            alt={`收據 ${index + 1}`}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
            onError={() => handleImgError(index, currentUrl as string)}
          />
        )}
      </div>

      {/* Thumbnail strip (only if multiple) */}
      {paths.length > 1 && (
        <div
          className="flex items-center gap-2 p-3 overflow-x-auto bg-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          {urls.map((url, i) => {
            const thumbFailed = url === null || imgError.has(i)
            return (
              <button
                key={paths[i]}
                onClick={() => setIndex(i)}
                className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                  i === index ? 'border-white' : 'border-transparent opacity-60'
                }`}
                aria-label={`檢視第 ${i + 1} 張`}
              >
                {typeof url === 'string' && !thumbFailed ? (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                ) : thumbFailed ? (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/60 text-xs">⚠</div>
                ) : (
                  <div className="w-full h-full bg-white/10 animate-pulse" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
