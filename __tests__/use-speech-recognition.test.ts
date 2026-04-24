import {
  isSpeechRecognitionSupported,
  mapSpeechError,
} from '@/hooks/use-speech-recognition'

describe('isSpeechRecognitionSupported', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    // @ts-expect-error restore original window after test
    globalThis.window = originalWindow
  })

  it('returns false when window is undefined (SSR)', () => {
    // @ts-expect-error simulate SSR by removing window
    delete globalThis.window
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('returns true when SpeechRecognition is on window', () => {
    // @ts-expect-error assigning mock window for feature-detection test
    globalThis.window = { SpeechRecognition: function () {} }
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns true when only webkitSpeechRecognition is on window', () => {
    // @ts-expect-error assigning mock window with vendor-prefixed API
    globalThis.window = { webkitSpeechRecognition: function () {} }
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns false when neither constructor is present', () => {
    // @ts-expect-error assigning empty window to assert neither API present
    globalThis.window = {}
    expect(isSpeechRecognitionSupported()).toBe(false)
  })
})

describe('mapSpeechError', () => {
  it.each([
    ['not-allowed', 'permission_denied'],
    ['service-not-allowed', 'permission_denied'],
    ['no-speech', 'no_speech'],
    ['network', 'network'],
    ['aborted', 'aborted'],
    ['unknown-err', 'other'],
    ['', 'other'],
    ['something-else', 'other'],
  ])('maps "%s" to "%s"', (raw, expected) => {
    expect(mapSpeechError(raw)).toBe(expected)
  })
})
