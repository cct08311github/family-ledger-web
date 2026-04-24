import { recomputeSplitsForAmount } from '@/lib/scale-splits'
import type { SplitDetail } from '@/lib/types'

function split(
  memberId: string,
  memberName: string,
  shareAmount: number,
  paidAmount: number,
  isParticipant = true,
): SplitDetail {
  return { memberId, memberName, shareAmount, paidAmount, isParticipant }
}

describe('recomputeSplitsForAmount', () => {
  describe('non-shared expenses', () => {
    it('returns splits unchanged (no-op)', () => {
      const splits = [split('m1', '爸', 100, 100)]
      const result = recomputeSplitsForAmount(
        { isShared: false, splitMethod: 'equal', amount: 100, payerId: 'm1', splits },
        200,
      )
      expect(result).toEqual(splits)
    })
  })

  describe('newAmount <= 0', () => {
    it('returns splits unchanged (invalid target)', () => {
      const splits = [split('m1', '爸', 100, 100)]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'equal', amount: 100, payerId: 'm1', splits },
        0,
      )
      expect(result).toEqual(splits)
    })
  })

  describe('equal splits', () => {
    it('rebuilds for 2 participants, exact division', () => {
      const splits = [
        split('m1', '爸', 50, 100),
        split('m2', '媽', 50, 0),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'equal', amount: 100, payerId: 'm1', splits },
        200,
      )
      expect(result[0]).toMatchObject({ shareAmount: 100, paidAmount: 200 })
      expect(result[1]).toMatchObject({ shareAmount: 100, paidAmount: 0 })
      expect(result[0].shareAmount + result[1].shareAmount).toBe(200)
    })

    it('rebuilds for 3 participants with remainder on LAST', () => {
      const splits = [
        split('m1', '爸', 33, 100),
        split('m2', '媽', 33, 0),
        split('m3', '子', 34, 0),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'equal', amount: 100, payerId: 'm1', splits },
        301,
      )
      // 301/3 = 100.33 → rounded 100, remainder 1 to last
      expect(result[0].shareAmount).toBe(100)
      expect(result[1].shareAmount).toBe(100)
      expect(result[2].shareAmount).toBe(101)
      expect(result.reduce((s, x) => s + x.shareAmount, 0)).toBe(301)
    })

    it('skips non-participants (zero share, zero paid unless payer)', () => {
      const splits = [
        split('m1', '爸', 100, 200, true),
        split('m2', '媽', 100, 0, true),
        split('m3', '客', 0, 0, false),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'equal', amount: 200, payerId: 'm1', splits },
        300,
      )
      expect(result[0]).toMatchObject({ shareAmount: 150, paidAmount: 300 })
      expect(result[1]).toMatchObject({ shareAmount: 150, paidAmount: 0 })
      expect(result[2]).toMatchObject({ shareAmount: 0, paidAmount: 0 })
    })
  })

  describe('non-equal splits (percentage / custom)', () => {
    it('scales proportionally; remainder to last participant', () => {
      // original: 100 payer pays, split 30 / 70
      const splits = [
        split('m1', '爸', 30, 100),
        split('m2', '媽', 70, 0),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'custom', amount: 100, payerId: 'm1', splits },
        200,
      )
      // ratio 2 → 60/140
      expect(result[0]).toMatchObject({ shareAmount: 60, paidAmount: 200 })
      expect(result[1]).toMatchObject({ shareAmount: 140, paidAmount: 0 })
      expect(result[0].shareAmount + result[1].shareAmount).toBe(200)
    })

    it('handles rounding remainder (3x scale on 33/33/34 → 100/100/100 = 300)', () => {
      const splits = [
        split('m1', '爸', 33, 100),
        split('m2', '媽', 33, 0),
        split('m3', '子', 34, 0),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'percentage', amount: 100, payerId: 'm1', splits },
        301,
      )
      // ratio 3.01; 33*3.01 = 99.33 → 99, 34*3.01 = 102.34 → 102
      // sum = 99+99+102 = 300; remainder 1 → last becomes 103
      expect(result.reduce((s, x) => s + x.shareAmount, 0)).toBe(301)
      expect(result[2].shareAmount).toBeGreaterThan(result[0].shareAmount)
    })

    it('falls back to equal rebuild when original amount was 0 (degenerate)', () => {
      const splits = [
        split('m1', '爸', 0, 0),
        split('m2', '媽', 0, 0),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'custom', amount: 0, payerId: 'm1', splits },
        200,
      )
      expect(result[0].shareAmount).toBe(100)
      expect(result[1].shareAmount).toBe(100)
    })

    it('weight method also scales proportionally', () => {
      const splits = [
        split('m1', '爸', 20, 100),
        split('m2', '媽', 80, 0),
      ]
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'weight', amount: 100, payerId: 'm1', splits },
        500,
      )
      expect(result[0]).toMatchObject({ shareAmount: 100, paidAmount: 500 })
      expect(result[1]).toMatchObject({ shareAmount: 400, paidAmount: 0 })
    })
  })

  describe('sum invariant', () => {
    it.each([
      [7, 13],
      [100, 333],
      [999, 1],
      [1, 100000],
    ])('sum of participant shares equals new amount (%s → %s)', (oldAmt, newAmt) => {
      const splits = [
        split('m1', 'a', 0, oldAmt, true),
        split('m2', 'b', oldAmt, 0, true),
      ]
      // set share sum equal to oldAmt (equal split scenario)
      splits[0].shareAmount = Math.floor(oldAmt / 2)
      splits[1].shareAmount = oldAmt - splits[0].shareAmount
      const result = recomputeSplitsForAmount(
        { isShared: true, splitMethod: 'custom', amount: oldAmt, payerId: 'm1', splits },
        newAmt,
      )
      const sum = result.reduce((s, x) => s + (x.isParticipant ? x.shareAmount : 0), 0)
      expect(sum).toBe(newAmt)
    })
  })
})
