/**
 * A synchronous in-flight guard for form submissions.
 *
 * React state (`useState`) updates are batched — `setSaving(true)` does not
 * block a second click that happens before the next render flush. On mobile,
 * fast taps (touchend + click within ~50–100ms) can slip through an
 * `disabled={saving}` button and trigger `handleSave` twice, causing duplicate
 * writes (e.g. duplicate expense records). This guard uses a mutable flag that
 * flips synchronously inside the click handler, closing that race window.
 *
 * Pair it with `useSubmitGuard` (a React hook) to also drive a UI-visible
 * "saving" state via `useState`. See Issue #193.
 */
export interface SubmitGuard {
  tryAcquire(): boolean
  release(): void
  isInFlight(): boolean
}

export function createSubmitGuard(): SubmitGuard {
  let inFlight = false
  return {
    tryAcquire(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    release(): void {
      inFlight = false
    },
    isInFlight(): boolean {
      return inFlight
    },
  }
}
