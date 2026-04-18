import { createSubmitGuard } from '@/lib/submit-guard'

describe('createSubmitGuard', () => {
  it('allows first acquire', () => {
    const g = createSubmitGuard()
    expect(g.tryAcquire()).toBe(true)
  })

  it('rejects second acquire without release', () => {
    const g = createSubmitGuard()
    g.tryAcquire()
    expect(g.tryAcquire()).toBe(false)
  })

  it('rejects many rapid acquires until released', () => {
    const g = createSubmitGuard()
    expect(g.tryAcquire()).toBe(true)
    for (let i = 0; i < 5; i++) {
      expect(g.tryAcquire()).toBe(false)
    }
    g.release()
    expect(g.tryAcquire()).toBe(true)
  })

  it('allows re-acquire after release', () => {
    const g = createSubmitGuard()
    g.tryAcquire()
    g.release()
    expect(g.tryAcquire()).toBe(true)
  })

  it('isInFlight reflects acquire state', () => {
    const g = createSubmitGuard()
    expect(g.isInFlight()).toBe(false)
    g.tryAcquire()
    expect(g.isInFlight()).toBe(true)
    g.release()
    expect(g.isInFlight()).toBe(false)
  })

  it('release is idempotent when not held', () => {
    const g = createSubmitGuard()
    expect(() => g.release()).not.toThrow()
    expect(g.isInFlight()).toBe(false)
    expect(g.tryAcquire()).toBe(true)
  })

  it('guards across instances independently', () => {
    const a = createSubmitGuard()
    const b = createSubmitGuard()
    a.tryAcquire()
    expect(b.tryAcquire()).toBe(true)
    expect(a.isInFlight()).toBe(true)
    expect(b.isInFlight()).toBe(true)
  })
})
