'use client'

import { useEffect, type RefObject } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Minimum horizontal distance in px before a swipe counts. */
  threshold?: number
  /** Horizontal must be this many times bigger than vertical to avoid vertical scroll hijack. */
  horizontalRatio?: number
}

/**
 * Lightweight touch-swipe detector for mobile navigation gestures.
 *
 * Attaches `touchstart`/`touchend` listeners to the referenced element and
 * fires the corresponding callback when the swipe is predominantly
 * horizontal and exceeds `threshold`. Uses `passive: true` so it doesn't
 * block vertical scrolling. Used by /records to let users left-swipe to
 * next month, right-swipe to previous month (Issue #221).
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, threshold = 60, horizontalRatio = 1.5 }: SwipeOptions,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false
        return
      }
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.abs(dx) < threshold) return
      if (Math.abs(dx) < Math.abs(dy) * horizontalRatio) return
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, onSwipeLeft, onSwipeRight, threshold, horizontalRatio])
}
