import { computeOffset } from '@/hooks/use-pull-to-refresh'

describe('computeOffset', () => {
  it('returns 0 for non-positive drag', () => {
    expect(computeOffset(0, 80)).toBe(0)
    expect(computeOffset(-10, 80)).toBe(0)
    expect(computeOffset(-100, 80)).toBe(0)
  })

  it('returns dy directly when below threshold', () => {
    expect(computeOffset(20, 80)).toBe(20)
    expect(computeOffset(50, 80)).toBe(50)
    expect(computeOffset(80, 80)).toBe(80)
  })

  it('applies diminishing resistance past threshold', () => {
    // dy = 81, threshold = 80 → over = 1 → 80 + sqrt(1)*3 = 83
    expect(computeOffset(81, 80)).toBe(83)
    // dy = 84, over = 4 → 80 + sqrt(4)*3 = 86
    expect(computeOffset(84, 80)).toBe(86)
    // dy = 180, over = 100 → 80 + sqrt(100)*3 = 110
    expect(computeOffset(180, 80)).toBe(110)
  })

  it('is monotonically non-decreasing', () => {
    let prev = 0
    for (let dy = 0; dy < 500; dy += 5) {
      const next = computeOffset(dy, 80)
      expect(next).toBeGreaterThanOrEqual(prev)
      prev = next
    }
  })

  it('respects custom threshold', () => {
    expect(computeOffset(100, 100)).toBe(100)
    expect(computeOffset(100, 50)).toBe(50 + Math.sqrt(50) * 3)
  })

  it('handles very small threshold gracefully', () => {
    // threshold=1, dy=10 → over=9 → 1 + 9 = not 10; sqrt(9)*3 = 9 → total 10
    expect(computeOffset(10, 1)).toBe(10)
  })
})
