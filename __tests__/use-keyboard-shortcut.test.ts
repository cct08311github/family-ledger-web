import { isEditableTarget, shouldIgnoreEvent } from '@/hooks/use-keyboard-shortcut'

// Duck-typed HTMLElement stand-in so tests don't require jsdom.
class FakeEl {
  constructor(
    public tagName: string,
    public isContentEditable = false,
  ) {}
}
// Make FakeEl satisfy `instanceof HTMLElement` by assigning to the global.
// The hook tests only rely on the runtime check — this keeps them env-agnostic.
beforeAll(() => {
  // @ts-expect-error installing fake HTMLElement global for hook filter tests
  globalThis.HTMLElement = FakeEl
})

describe('isEditableTarget', () => {
  it('returns false for null', () => {
    expect(isEditableTarget(null)).toBe(false)
  })

  it.each([
    ['INPUT', true],
    ['TEXTAREA', true],
    ['SELECT', true],
    ['DIV', false],
    ['BUTTON', false],
    ['P', false],
    ['A', false],
  ])('returns %s for <%s>', (tag, expected) => {
    expect(isEditableTarget(new FakeEl(tag) as unknown as HTMLElement)).toBe(expected)
  })

  it('returns true for contenteditable div', () => {
    expect(isEditableTarget(new FakeEl('DIV', true) as unknown as HTMLElement)).toBe(true)
  })

  it('returns false for non-Element-like value', () => {
    // Plain object isn't instanceof HTMLElement
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(false)
  })
})

describe('shouldIgnoreEvent', () => {
  function makeEvent(partial: Partial<Parameters<typeof shouldIgnoreEvent>[0]> = {}) {
    return {
      target: null,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      ...partial,
    }
  }

  it('ignores when meta key held (reserve Cmd+R etc.)', () => {
    expect(shouldIgnoreEvent(makeEvent({ metaKey: true }))).toBe(true)
  })

  it('ignores when ctrl key held', () => {
    expect(shouldIgnoreEvent(makeEvent({ ctrlKey: true }))).toBe(true)
  })

  it('ignores when alt key held', () => {
    expect(shouldIgnoreEvent(makeEvent({ altKey: true }))).toBe(true)
  })

  it('ignores when focus is in an input', () => {
    const input = new FakeEl('INPUT') as unknown as HTMLElement
    expect(shouldIgnoreEvent(makeEvent({ target: input }))).toBe(true)
  })

  it('does NOT ignore plain key with no target and no modifiers', () => {
    expect(shouldIgnoreEvent(makeEvent({ target: null }))).toBe(false)
  })

  it('does NOT ignore plain key on button (not editable)', () => {
    const btn = new FakeEl('BUTTON') as unknown as HTMLElement
    expect(shouldIgnoreEvent(makeEvent({ target: btn }))).toBe(false)
  })
})
