/**
 * Pure helper: build the log payload for Next.js error boundaries.
 *
 * Extracted so the build logic is unit-testable without needing a React render
 * harness (the project has no @testing-library/react yet). Also keeps the two
 * boundary components (auth/error.tsx, global-error.tsx) DRY — they only differ
 * in the log prefix string.
 *
 * Note: `pathname` is NOT included here — `log-service.writeSystemLog` already
 * captures `window.location.href` (which subsumes pathname + query). Adding
 * pathname separately would duplicate and could drift.
 *
 * Known limitation (Issue #177 comment): `global-error.tsx` runs before the
 * root providers mount. If it fires before Firebase auth is ready,
 * `isSignedIn()` in firestore.rules will be false → the system_logs write is
 * silently rejected by rules. Accepted trade-off: error-boundary logs are
 * best-effort; a root crash early in boot is rare and hard to observe server-
 * side without a bespoke auth-free logging endpoint.
 */
export interface BoundaryErrorLogContext {
  digest?: string
  message: string
  stack?: string
}

export function buildBoundaryLogContext(
  error: Error & { digest?: string },
): BoundaryErrorLogContext {
  return {
    digest: error.digest,
    message: error.message,
    stack: error.stack,
  }
}
