import { formatBatchSettlementSummary } from '@/lib/batch-settlement-summary'

const fmt = (n: number) => `NT$ ${n.toLocaleString()}`

describe('formatBatchSettlementSummary', () => {
  it('degrades gracefully on empty list', () => {
    expect(formatBatchSettlementSummary([], fmt)).toBe('批次結清（無項目）')
  })

  it('renders a single item in the same shape as a solo settlement', () => {
    expect(
      formatBatchSettlementSummary(
        [{ fromMemberName: '爸爸', toMemberName: '泳淳', amount: 2000 }],
        fmt,
      ),
    ).toBe('批次結清：爸爸 → 泳淳 NT$ 2,000')
  })

  it('lists all items when count ≤ 3', () => {
    const out = formatBatchSettlementSummary(
      [
        { fromMemberName: '爸爸', toMemberName: '泳淳', amount: 100 },
        { fromMemberName: '媽媽', toMemberName: '泳淳', amount: 200 },
        { fromMemberName: '爸爸', toMemberName: '媽媽', amount: 300 },
      ],
      fmt,
    )
    expect(out).toBe(
      '批次結清（共 3 筆）：爸爸 → 泳淳 NT$ 100、媽媽 → 泳淳 NT$ 200、爸爸 → 媽媽 NT$ 300',
    )
  })

  it('truncates after 3 items when count > 3 and names the REMAINING count', () => {
    const out = formatBatchSettlementSummary(
      [
        { fromMemberName: 'A', toMemberName: 'B', amount: 10 },
        { fromMemberName: 'C', toMemberName: 'D', amount: 20 },
        { fromMemberName: 'E', toMemberName: 'F', amount: 30 },
        { fromMemberName: 'G', toMemberName: 'H', amount: 40 },
        { fromMemberName: 'I', toMemberName: 'J', amount: 50 },
      ],
      fmt,
    )
    expect(out).toContain('A → B NT$ 10')
    expect(out).toContain('C → D NT$ 20')
    expect(out).toContain('E → F NT$ 30')
    expect(out).not.toContain('G → H')
    // 5 total, 3 shown → "…等 2 筆" (remaining), not "…等 5 筆" (total).
    expect(out).toContain('…等 2 筆')
    expect(out).toContain('共 5 筆')
  })

  it('shows exactly 0 remaining when count === MAX_INLINE', () => {
    const out = formatBatchSettlementSummary(
      [
        { fromMemberName: 'A', toMemberName: 'B', amount: 1 },
        { fromMemberName: 'C', toMemberName: 'D', amount: 2 },
        { fromMemberName: 'E', toMemberName: 'F', amount: 3 },
      ],
      fmt,
    )
    expect(out).not.toContain('…等')
  })

  it('uses the provided amount formatter', () => {
    const out = formatBatchSettlementSummary(
      [{ fromMemberName: '小明', toMemberName: '小華', amount: 1500 }],
      (n) => `$${n}`,
    )
    expect(out).toBe('批次結清：小明 → 小華 $1500')
  })

  it('falls back to a default formatter if none supplied', () => {
    const out = formatBatchSettlementSummary([
      { fromMemberName: 'A', toMemberName: 'B', amount: 1234 },
    ])
    expect(out).toMatch(/A → B .+1/)
  })

  it('handles very large batches deterministically', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      fromMemberName: `M${i}`,
      toMemberName: `N${i}`,
      amount: i,
    }))
    const out = formatBatchSettlementSummary(items, fmt)
    // 50 total, 3 shown → "…等 47 筆".
    expect(out).toContain('…等 47 筆')
    expect(out).toContain('共 50 筆')
    expect(out).toContain('M0 → N0')
    expect(out).not.toContain('M3 → N3')
  })
})
