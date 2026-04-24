/**
 * Haptic feedback wrapper (Issue #248).
 *
 * Uses the Web Vibration API (`navigator.vibrate`) where supported —
 * Android Chrome, Firefox, Edge. iOS Safari silently no-ops (not a bug,
 * Apple has deliberately not implemented the API). Wrapped in try/catch
 * so any browser quirk degrades gracefully.
 *
 * Keep patterns short (< 100ms total). Longer vibrations are jarring and
 * drain battery for no perceivable benefit.
 */

export type HapticKind = 'success' | 'light' | 'warning' | 'error'

const PATTERNS: Record<HapticKind, number | readonly number[]> = {
  light: 15,
  success: 40,
  warning: [30, 30] as const,
  error: [60, 40, 60] as const,
}

/**
 * Feature-detect — callable from tests and components.
 */
export function isHapticSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.vibrate === 'function'
}

/**
 * Fire a haptic cue. Safe to call from any browser; unsupported browsers
 * silently skip. Never throws.
 */
export function hapticFeedback(kind: HapticKind): void {
  try {
    if (!isHapticSupported()) return
    const pattern = PATTERNS[kind]
    navigator.vibrate(pattern as number | number[])
  } catch {
    // Safari iOS or locked-down env: swallow. No-op is the contract.
  }
}
