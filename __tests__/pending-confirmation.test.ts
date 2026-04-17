import {
  filterConfirmable,
  summarizeConfirmResults,
  confirmToastFromSummary,
} from '@/lib/pending-confirmation'

describe('filterConfirmable', () => {
  it('keeps positive-amount entries', () => {
    expect(filterConfirmable([
      { id: 'a', amount: 100 },
      { id: 'b', amount: 0.01 },
    ])).toHaveLength(2)
  })

  it('drops zero-amount entries', () => {
    const out = filterConfirmable([
      { id: 'a', amount: 100 },
      { id: 'b', amount: 0 },
      { id: 'c', amount: 50 },
    ])
    expect(out.map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('drops negative-amount entries (defensive)', () => {
    expect(filterConfirmable([
      { id: 'a', amount: -50 },
      { id: 'b', amount: 100 },
    ])).toEqual([{ id: 'b', amount: 100 }])
  })

  it('returns empty for empty input', () => {
    expect(filterConfirmable([])).toEqual([])
  })
})

describe('summarizeConfirmResults', () => {
  function ok(): PromiseSettledResult<unknown> { return { status: 'fulfilled', value: undefined } }
  function fail(): PromiseSettledResult<unknown> { return { status: 'rejected', reason: new Error('x') } }

  it('counts all-success', () => {
    expect(summarizeConfirmResults([ok(), ok(), ok()])).toEqual({ total: 3, ok: 3, fail: 0 })
  })

  it('counts all-failure', () => {
    expect(summarizeConfirmResults([fail(), fail()])).toEqual({ total: 2, ok: 0, fail: 2 })
  })

  it('counts mixed', () => {
    expect(summarizeConfirmResults([ok(), fail(), ok()])).toEqual({ total: 3, ok: 2, fail: 1 })
  })

  it('handles empty (degenerate)', () => {
    expect(summarizeConfirmResults([])).toEqual({ total: 0, ok: 0, fail: 0 })
  })
})

describe('confirmToastFromSummary', () => {
  it('returns null when nothing was attempted', () => {
    expect(confirmToastFromSummary({ total: 0, ok: 0, fail: 0 })).toBeNull()
  })

  it('returns success message when all OK', () => {
    expect(confirmToastFromSummary({ total: 3, ok: 3, fail: 0 })).toEqual({
      message: '已確認 3 筆定期支出',
      level: 'success',
    })
  })

  it('returns warning message when some failed', () => {
    expect(confirmToastFromSummary({ total: 5, ok: 3, fail: 2 })).toEqual({
      message: '已確認 3 筆，2 筆失敗（請稍後重試）',
      level: 'warning',
    })
  })

  it('returns warning when ALL failed (still actionable: user knows nothing succeeded)', () => {
    expect(confirmToastFromSummary({ total: 2, ok: 0, fail: 2 })).toEqual({
      message: '已確認 0 筆，2 筆失敗（請稍後重試）',
      level: 'warning',
    })
  })
})
