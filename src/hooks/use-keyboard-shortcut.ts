'use client'

import { useEffect } from 'react'

export interface ShortcutBinding {
  /** Key to match — case-insensitive, compared against `event.key`. */
  key: string
  /** Require Shift. Default false. */
  shift?: boolean
  handler: () => void
}

/**
 * Returns true if the current focus target is an editable element where a
 * plain alpha key should be treated as text input, not a shortcut.
 *
 * Exported so tests can exercise the filter without mounting DOM.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Should a keyboard event trigger a shortcut? Separate from the matcher so
 * both parts can be unit-tested independently.
 */
export function shouldIgnoreEvent(event: {
  target: EventTarget | null
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true
  return isEditableTarget(event.target)
}

/**
 * Global keyboard shortcut registration for the authenticated layout
 * (Issue #235). Ignores events when the user is typing in inputs, textareas,
 * selects, or contenteditable regions; also ignores events with modifier
 * keys so browser shortcuts (Cmd+R, Ctrl+T, …) keep working.
 *
 * Bindings are compared case-insensitively. Shift is explicit when needed
 * (e.g. `?` requires shift=true on most US layouts).
 */
export function useKeyboardShortcuts(bindings: readonly ShortcutBinding[]): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (shouldIgnoreEvent(event)) return
      for (const b of bindings) {
        if (event.key.toLowerCase() !== b.key.toLowerCase()) continue
        if ((b.shift ?? false) !== event.shiftKey) continue
        event.preventDefault()
        b.handler()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings])
}
