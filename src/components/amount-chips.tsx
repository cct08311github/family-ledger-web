'use client'

import { applyAmountChip, type AmountChip } from '@/lib/amount-expression'

interface AmountChipsProps {
  value: string
  onChange: (_next: string) => void
  className?: string
}

const CHIPS: { label: string; op: AmountChip }[] = [
  { label: '+50', op: '+50' },
  { label: '+100', op: '+100' },
  { label: '-50', op: '-50' },
  { label: '×2', op: '*2' },
  { label: '÷2', op: '/2' },
  { label: '清除', op: 'clear' },
]

export function AmountChips({ value, onChange, className }: AmountChipsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      {CHIPS.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onChange(applyAmountChip(value, c.op))}
          className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors"
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
