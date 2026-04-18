'use client'

import { useCallback, useRef, useState } from 'react'
import { createSubmitGuard } from '@/lib/submit-guard'

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
 *
 * Scope: this is a client-side, single-JS-environment guard. It does NOT
 * protect against cross-tab, post-reload, or API-bypass duplicates. For those
 * paths, rely on server-side idempotency (Firestore rule `allow create: if
 * !exists(...)` on pre-generated doc IDs, or a dedicated idempotencyKey).
 */
export function useSubmitGuard() {
  // Direct init: createSubmitGuard() is a pure, cheap allocation, and useRef
  // only invokes the initializer once. Avoids render-body side effects.
  const guardRef = useRef(createSubmitGuard())
  const [inFlight, setInFlight] = useState(false)

  const run = useCallback(async function runImpl<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const guard = guardRef.current
    if (!guard.tryAcquire()) return undefined
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
