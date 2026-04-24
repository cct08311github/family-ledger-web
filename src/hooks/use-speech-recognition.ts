'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Web Speech API wrapper for voice-to-text in Traditional Chinese (Issue #229).
 *
 * Feature detects `SpeechRecognition` / `webkitSpeechRecognition` and exposes
 * a stable hook API. Browsers without support (Firefox desktop, very old Safari)
 * get `supported: false` and the UI hides the button.
 *
 * Not typed against the TS DOM lib because the underlying interface is still
 * vendor-prefixed in Chrome/Safari; we model only the subset we use.
 */

export type SpeechErrorCode =
  | 'not_supported'
  | 'permission_denied'
  | 'no_speech'
  | 'network'
  | 'aborted'
  | 'other'

export interface UseSpeechRecognitionState {
  supported: boolean
  listening: boolean
  error: SpeechErrorCode | null
  transcript: string
  start: () => void
  stop: () => void
  reset: () => void
}

interface MinimalRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((_event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((_event: { error: string }) => void) | null
  onend: (() => void) | null
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return 'SpeechRecognition' in w || 'webkitSpeechRecognition' in w
}

export function mapSpeechError(raw: string): SpeechErrorCode {
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission_denied'
    case 'no-speech':
      return 'no_speech'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'other'
  }
}

export function useSpeechRecognition(lang = 'zh-TW'): UseSpeechRecognitionState {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<SpeechErrorCode | null>(null)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<MinimalRecognition | null>(null)

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported())
  }, [])

  const start = useCallback(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as Record<string, unknown>
    const Ctor =
      (w.SpeechRecognition as (new () => MinimalRecognition) | undefined) ??
      (w.webkitSpeechRecognition as (new () => MinimalRecognition) | undefined)
    if (!Ctor) {
      setError('not_supported')
      return
    }
    try {
      const rec = new Ctor()
      rec.lang = lang
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = (event) => {
        const first = event.results[0]
        if (first && first[0]) setTranscript(first[0].transcript)
      }
      rec.onerror = (event) => {
        setError(mapSpeechError(event.error))
        setListening(false)
      }
      rec.onend = () => {
        setListening(false)
      }
      recognitionRef.current = rec
      setError(null)
      setTranscript('')
      setListening(true)
      rec.start()
    } catch {
      setError('other')
      setListening(false)
    }
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  // Abort any in-flight recognition when the component unmounts so the
  // browser doesn't keep the mic indicator on screen after navigation.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return { supported, listening, error, transcript, start, stop, reset }
}
