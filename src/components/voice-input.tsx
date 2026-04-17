'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { parseExpense, type ParsedExpense } from '@/lib/services/local-expense-parser'
import { auth } from '@/lib/firebase'
import { isSpeechRecognitionSupported } from '@/lib/speech-recognition-support'

const GEMINI_KEY = 'gemini-api-key'

// Web Speech API types — cast via interface to avoid lib version dependency
interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((_e: SpeechRecognitionEvent) => void) | null
  onerror: ((_e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type SpeechRecognitionCtor = new () => ISpeechRecognition

interface Props {
  availableCategories?: string[]
  onParsed: (_result: ParsedExpense) => void
}

type Status = 'idle' | 'listening' | 'processing' | 'error'

export function VoiceInput({ availableCategories, onParsed }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const statusRef = useRef<Status>('idle') // mirror for sync reads inside callbacks
  const [transcript, setTranscript] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  // null = detection pending (SSR/first render); false = known unsupported;
  // true = ready. Detected via useEffect to avoid hydration mismatches.
  // Issue #181.
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported(typeof window !== 'undefined' ? window : null))
  }, [])

  const updateStatus = useCallback((s: Status) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const getSpeechRecognition = useCallback((): SpeechRecognitionCtor | null => {
    if (typeof window === 'undefined') return null
    const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
  }, [])

  const parseText = useCallback(async (text: string) => {
    updateStatus('processing')
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem(GEMINI_KEY) : null

    if (apiKey) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      try {
        const idToken = await auth.currentUser?.getIdToken() ?? ''
        const res = await fetch('/api/parse-expense', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
            'x-gemini-key': apiKey,
          },
          body: JSON.stringify({ text, categories: availableCategories }),
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json() as ParsedExpense
          // Check for error field; fallback if description missing
          if (!('error' in data) && data.description) {
            onParsed(data)
            updateStatus('idle')
            return
          }
        }
      } catch {
        // network error or timeout — fall through to local parser
      } finally {
        clearTimeout(timeoutId)
      }
    }

    // Fallback: local parser
    const result = parseExpense(text, availableCategories)
    onParsed(result)
    updateStatus('idle')
  }, [availableCategories, onParsed, updateStatus])

  const startListening = useCallback(() => {
    // Detection already ran in useEffect; the button is hidden/disabled when
    // unsupported, so reaching here with null Ctor would be a bug — treat as
    // unreachable but guard defensively.
    const SpeechRec = getSpeechRecognition()
    if (!SpeechRec) return

    setErrorMsg('')
    setTranscript('')
    updateStatus('listening')

    const recognition = new SpeechRec()
    recognition.lang = 'zh-TW'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('')
      setTranscript(text)
      if (e.results[e.results.length - 1].isFinal) {
        recognition.stop()
        parseText(text)
      }
    }

    recognition.onerror = (e) => {
      recognition.stop()
      recognitionRef.current = null
      setErrorMsg(e.error === 'not-allowed' ? '請允許麥克風權限' : `語音辨識錯誤：${e.error}`)
      updateStatus('error')
    }

    recognition.onend = () => {
      // Use statusRef (not closed-over status) to read the current value synchronously
      if (statusRef.current === 'listening') updateStatus('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [getSpeechRecognition, parseText, updateStatus])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    updateStatus('idle')
  }, [updateStatus])

  const isListening = status === 'listening'
  const isProcessing = status === 'processing'

  // Detection still pending — reserve the slot with a same-sized placeholder
  // so parent's flex layout doesn't reflow after useEffect resolves. Prevents
  // a brief title-left-align flash on iOS Safari where first paint beats
  // effect resolution.
  if (supported === null) return <div className="w-14 h-14" aria-hidden="true" />

  const isUnsupported = supported === false
  const unsupportedMsgId = 'voice-input-unsupported-msg'

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing || isUnsupported}
        aria-label={isListening ? '停止錄音' : '語音輸入'}
        aria-describedby={isUnsupported ? unsupportedMsgId : undefined}
        title={isUnsupported ? '此瀏覽器不支援語音輸入' : undefined}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isUnsupported
            ? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
            : isListening
              ? 'bg-red-500 text-white scale-110'
              : 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:scale-105'
        }`}>
        {isProcessing ? (
          <span className="animate-spin text-base">⟳</span>
        ) : isListening ? (
          '⏹'
        ) : (
          '🎤'
        )}
        {isListening && (
          <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-60" />
        )}
      </button>

      {isUnsupported && (
        <p id={unsupportedMsgId} className="text-xs text-[var(--muted-foreground)]">此瀏覽器不支援語音</p>
      )}
      {isListening && (
        <p className="text-xs text-[var(--muted-foreground)] animate-pulse">聆聽中…</p>
      )}
      {isProcessing && (
        <p className="text-xs text-[var(--muted-foreground)]">解析中…</p>
      )}
      {transcript && status === 'idle' && (
        <p className="text-xs text-[var(--muted-foreground)] max-w-xs text-center">&quot;{transcript}&quot;</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-[var(--destructive)]">{errorMsg}</p>
      )}
    </div>
  )
}
