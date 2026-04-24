'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

export interface PullToRefreshOptions {
  onRefresh: () => void | Promise<void>
  threshold?: number
  /** When false, touch listeners are not attached. */
  enabled?: boolean
}

export interface PullToRefreshState {
  /** Current visual offset in px (0..threshold+overshoot). */
  offset: number
  /** Whether an onRefresh callback is currently in flight. */
  refreshing: boolean
  /** True once offset ≥ threshold — used to switch the label to "放開更新". */
  armed: boolean
}

/**
 * Pure decision helper — returns the visual offset to render given the
 * raw vertical drag distance. Extracted so the math is unit-testable
 * without a DOM. Resistance curve ramps slowly past threshold so the UI
 * feels elastic but not runaway.
 */
export function computeOffset(dy: number, threshold: number): number {
  if (dy <= 0) return 0
  if (dy <= threshold) return dy
  // Past threshold: diminishing returns (square root curve)
  const over = dy - threshold
  return threshold + Math.sqrt(over) * 3
}

/**
 * Pull-to-refresh detector for mobile touch scrolling (Issue #237).
 * Only activates when the scroll container is already at the top so it
 * doesn't fight native overscroll. Uses passive touchstart + touchmove
 * to avoid blocking the scroll path.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  { onRefresh, threshold = 80, enabled = true }: PullToRefreshOptions,
): PullToRefreshState {
  const [offset, setOffset] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const tracking = useRef(false)
  const refreshingRef = useRef(false)

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return
      if ((window.scrollY || document.documentElement.scrollTop) > 0) return
      if (e.touches.length !== 1) return
      startY.current = e.touches[0].clientY
      tracking.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        setOffset(0)
        return
      }
      setOffset(computeOffset(dy, threshold))
    }

    const onEnd = () => {
      if (!tracking.current) return
      tracking.current = false
      startY.current = null
      setOffset((current) => {
        if (current >= threshold && !refreshingRef.current) {
          setRefreshing(true)
          // Run in microtask so React can paint the "refreshing" state first
          Promise.resolve()
            .then(() => onRefresh())
            .catch(() => {})
            .finally(() => {
              setRefreshing(false)
              setOffset(0)
            })
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, onRefresh, threshold, enabled])

  return { offset, refreshing, armed: offset >= threshold }
}
