'use client'

import { useCallback, useRef, useState } from 'react'
import { createSubmitGuard, type SubmitGuard } from '@/lib/submit-guard'

/**
 * React hook wrapping `createSubmitGuard` for form handlers.
 *
 * Why this exists:
 *   `disabled={saving}` on a submit button does NOT block a second click that
 *   arrives before React flushes the re-render. On mobile, fast taps slip
 *   through and call `handleSave` twice — duplicate records. The guard flips
 *   a ref synchronously so the second call sees the in-flight state and bails.
 *
 * Usage:
 *   const { inFlight, run } = useSubmitGuard()
 *   async function onClick() {
 *     await run(async () => {
 *       await addExpense(...)
 *     })
 *   }
 *   // disabled={inFlight} still valuable for UI — but the real guard is `run`.
 *
 * Returns `undefined` when a second concurrent call is rejected, so callers
 * can distinguish "did not run" from "ran and returned undefined".
 */
// eslint-disable-next-line no-unused-vars
type RunFn = <T>(fn: () => Promise<T>) => Promise<T | undefined>

export function useSubmitGuard(): {
  inFlight: boolean
  run: RunFn
} {
  const guardRef = useRef<SubmitGuard | null>(null)
  if (guardRef.current === null) {
    guardRef.current = createSubmitGuard()
  }
  const [inFlight, setInFlight] = useState(false)

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    const guard = guardRef.current
    if (!guard || !guard.tryAcquire()) return undefined
    setInFlight(true)
    try {
      return await fn()
    } finally {
      guard.release()
      setInFlight(false)
    }
  }, [])

  return { inFlight, run }
}
