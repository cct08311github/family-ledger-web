/**
 * Feature-detect Web Speech API support.
 *
 * Pulled out as a pure function so it can be unit-tested without a React
 * render harness. Caller is responsible for running this inside a useEffect
 * to avoid SSR/hydration mismatches (server has no window). Issue #181.
 */

interface SpeechRecognitionWindow {
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
}

/**
 * Returns true if the current window exposes a SpeechRecognition constructor
 * (standard or webkit-prefixed). Returns false for undefined/null inputs — so
 * server-side calls are safe.
 */
export function isSpeechRecognitionSupported(
  win: SpeechRecognitionWindow | undefined | null,
): boolean {
  if (!win) return false
  return Boolean(win.SpeechRecognition ?? win.webkitSpeechRecognition)
}
