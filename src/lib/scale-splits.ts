/**
 * Helpers to recompute splits when only the expense amount (or category)
 * changes during inline edit (Issue #230).
 *
 * Equal splits are rebuilt from participants + new amount using the same
 * rounding rule as buildEqualSplits (remainder goes to LAST participant).
 *
 * Non-equal (percentage / custom / weight) splits are scaled proportionally
 * by (new / old) and the rounding remainder is similarly absorbed by the
 * last participant so the sum always equals the new amount exactly.
 *
 * Non-shared expenses return splits as-is (no-op).
 */
import type { SplitDetail, SplitMethod } from '@/lib/types'

interface ExpenseSliceForSplit {
  isShared: boolean
  splitMethod: SplitMethod
  amount: number
  payerId: string
  splits: SplitDetail[]
}

export function recomputeSplitsForAmount(
  expense: ExpenseSliceForSplit,
  newAmount: number,
): SplitDetail[] {
  if (!expense.isShared) return expense.splits
  if (newAmount <= 0) return expense.splits

  if (expense.splitMethod === 'equal') {
    return rebuildEqualSplits(expense.splits, newAmount, expense.payerId)
  }

  return scaleSplitsProportionally(expense.splits, expense.amount, newAmount, expense.payerId)
}

function rebuildEqualSplits(
  existing: SplitDetail[],
  newAmount: number,
  payerId: string,
): SplitDetail[] {
  const participants = existing.filter((s) => s.isParticipant)
  if (participants.length === 0) return existing

  const per = Math.round(newAmount / participants.length)
  const remainder = newAmount - per * participants.length
  let participantIdx = 0
  return existing.map((s) => {
    if (!s.isParticipant) {
      return { ...s, shareAmount: 0, paidAmount: s.memberId === payerId ? newAmount : 0 }
    }
    const isLastParticipant = participantIdx === participants.length - 1
    const share = isLastParticipant ? per + remainder : per
    participantIdx++
    return {
      ...s,
      shareAmount: share,
      paidAmount: s.memberId === payerId ? newAmount : 0,
    }
  })
}

function scaleSplitsProportionally(
  existing: SplitDetail[],
  oldAmount: number,
  newAmount: number,
  payerId: string,
): SplitDetail[] {
  // Degenerate source: fall back to equal rebuild so we don't produce zeros.
  if (oldAmount <= 0) {
    return rebuildEqualSplits(existing, newAmount, payerId)
  }

  const ratio = newAmount / oldAmount
  const scaled = existing.map((s) => ({
    ...s,
    shareAmount: s.isParticipant ? Math.round(s.shareAmount * ratio) : 0,
    paidAmount: s.memberId === payerId ? newAmount : 0,
  }))

  // Make the sum exact — put the remainder on the last participant.
  const currentSum = scaled.reduce((acc, s) => acc + (s.isParticipant ? s.shareAmount : 0), 0)
  const remainder = newAmount - currentSum
  if (remainder !== 0) {
    let lastParticipantIdx = -1
    for (let i = scaled.length - 1; i >= 0; i--) {
      if (scaled[i].isParticipant) {
        lastParticipantIdx = i
        break
      }
    }
    if (lastParticipantIdx >= 0) {
      scaled[lastParticipantIdx] = {
        ...scaled[lastParticipantIdx],
        shareAmount: scaled[lastParticipantIdx].shareAmount + remainder,
      }
    }
  }
  return scaled
}
