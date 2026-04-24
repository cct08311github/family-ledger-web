'use client'

import {
  AMOUNT_RANGE_KEYS,
  AMOUNT_RANGE_LABELS,
  type AmountRangeKey,
} from '@/lib/amount-range-filter'

interface AmountRangeChipsProps {
  value: AmountRangeKey
  onChange: (_next: AmountRangeKey) => void
  className?: string
}

export function AmountRangeChips({ value, onChange, className }: AmountRangeChipsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`} role="group" aria-label="金額區間篩選">
      {AMOUNT_RANGE_KEYS.map((k) => {
        const selected = value === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            aria-pressed={selected}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selected
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'
            }`}
          >
            {AMOUNT_RANGE_LABELS[k]}
          </button>
        )
      })}
    </div>
  )
}
