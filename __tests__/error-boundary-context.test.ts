import { buildBoundaryLogContext } from '@/lib/error-boundary-context'

describe('buildBoundaryLogContext', () => {
  it('extracts digest, message, stack from a Next.js boundary error', () => {
    const err = Object.assign(new Error('boom'), { digest: 'abc123' })
    err.stack = 'Error: boom\n    at foo.ts:10'
    const ctx = buildBoundaryLogContext(err)
    expect(ctx).toEqual({
      digest: 'abc123',
      message: 'boom',
      stack: 'Error: boom\n    at foo.ts:10',
    })
  })

  it('handles errors without a digest (plain Error cast to boundary shape)', () => {
    const err = new Error('no-digest') as Error & { digest?: string }
    const ctx = buildBoundaryLogContext(err)
    expect(ctx.digest).toBeUndefined()
    expect(ctx.message).toBe('no-digest')
  })

  it('handles errors without a stack', () => {
    const err = Object.assign(new Error('no-stack'), { digest: 'd1' })
    err.stack = undefined
    const ctx = buildBoundaryLogContext(err)
    expect(ctx.stack).toBeUndefined()
  })

  it('does NOT include pathname — that is captured by log-service `location.href`', () => {
    // Regression guard: log-service already writes window.location.href; adding
    // pathname here would double-store the same data and could drift over time.
    const err = Object.assign(new Error('x'), { digest: 'd' })
    const ctx = buildBoundaryLogContext(err)
    expect(ctx).not.toHaveProperty('pathname')
  })

  it('produces a plain JSON-serializable object (for Firestore write)', () => {
    const err = Object.assign(new Error('plain'), { digest: 'd' })
    expect(() => JSON.stringify(buildBoundaryLogContext(err))).not.toThrow()
  })
})
