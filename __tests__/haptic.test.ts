import { hapticFeedback, isHapticSupported } from '@/lib/haptic'

describe('isHapticSupported', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    // @ts-expect-error restore original navigator after test
    globalThis.navigator = originalNavigator
  })

  it('returns false when navigator is undefined (SSR)', () => {
    // @ts-expect-error simulate SSR
    delete globalThis.navigator
    expect(isHapticSupported()).toBe(false)
  })

  it('returns false when navigator has no vibrate', () => {
    // @ts-expect-error minimal navigator without vibrate
    globalThis.navigator = {}
    expect(isHapticSupported()).toBe(false)
  })

  it('returns true when navigator.vibrate is a function', () => {
    // @ts-expect-error navigator.vibrate function provided for support check
    globalThis.navigator = { vibrate: () => true }
    expect(isHapticSupported()).toBe(true)
  })
})

describe('hapticFeedback', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    // @ts-expect-error restore original navigator after test
    globalThis.navigator = originalNavigator
  })

  it('no-ops on unsupported browser (does not throw)', () => {
    // @ts-expect-error assign empty navigator for unsupported check
    globalThis.navigator = {}
    expect(() => hapticFeedback('success')).not.toThrow()
  })

  it('invokes navigator.vibrate with a number pattern for success', () => {
    const spy = jest.fn().mockReturnValue(true)
    // @ts-expect-error mock navigator with vibrate spy
    globalThis.navigator = { vibrate: spy }
    hapticFeedback('success')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(40)
  })

  it('invokes navigator.vibrate with an array pattern for error', () => {
    const spy = jest.fn().mockReturnValue(true)
    // @ts-expect-error mock navigator with vibrate spy
    globalThis.navigator = { vibrate: spy }
    hapticFeedback('error')
    expect(spy).toHaveBeenCalledWith([60, 40, 60])
  })

  it('invokes navigator.vibrate with a short pattern for light', () => {
    const spy = jest.fn().mockReturnValue(true)
    // @ts-expect-error mock navigator
    globalThis.navigator = { vibrate: spy }
    hapticFeedback('light')
    expect(spy).toHaveBeenCalledWith(15)
  })

  it('swallows exceptions from vibrate and does not propagate', () => {
    const spy = jest.fn().mockImplementation(() => {
      throw new Error('security denied')
    })
    // @ts-expect-error mock navigator with throwing vibrate
    globalThis.navigator = { vibrate: spy }
    expect(() => hapticFeedback('warning')).not.toThrow()
  })
})
