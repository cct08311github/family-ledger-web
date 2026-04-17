import { isSpeechRecognitionSupported } from '@/lib/speech-recognition-support'

describe('isSpeechRecognitionSupported', () => {
  it('returns true when window has SpeechRecognition constructor', () => {
    const win = { SpeechRecognition: class {} }
    expect(isSpeechRecognitionSupported(win)).toBe(true)
  })

  it('returns true when only webkit-prefixed constructor exists', () => {
    const win = { webkitSpeechRecognition: class {} }
    expect(isSpeechRecognitionSupported(win)).toBe(true)
  })

  it('returns true when both standard and prefixed exist', () => {
    const win = { SpeechRecognition: class {}, webkitSpeechRecognition: class {} }
    expect(isSpeechRecognitionSupported(win)).toBe(true)
  })

  it('returns false when neither constructor is present', () => {
    expect(isSpeechRecognitionSupported({})).toBe(false)
  })

  it('returns false when window is undefined (SSR safe)', () => {
    expect(isSpeechRecognitionSupported(undefined)).toBe(false)
  })

  it('returns false when window is null (SSR safe)', () => {
    expect(isSpeechRecognitionSupported(null)).toBe(false)
  })

  it('returns false when the constructor field is null', () => {
    // Some browsers used to expose a null property before removing it entirely;
    // match the Boolean-cast semantic.
    expect(isSpeechRecognitionSupported({ SpeechRecognition: null })).toBe(false)
  })

  it('returns false when the constructor field is undefined', () => {
    expect(isSpeechRecognitionSupported({ SpeechRecognition: undefined })).toBe(false)
  })
})
