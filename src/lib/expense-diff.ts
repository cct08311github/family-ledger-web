/**
 * Pure diff utility for expense edits (Issue #216).
 * No Firebase imports — fully unit-testable in isolation.
 */
import { paymentLabel } from '@/lib/utils'
import { formatEmailDate } from '@/lib/services/email-notification'

/**
 * Minimal snapshot of an expense's diffable scalar fields.
 * Splits are intentionally excluded (too complex to diff inline).
 */
export interface ExpenseSnapshot {
  description?: string | null
  amount?: number | null
  category?: string | null
  date?: Date | { toDate(): Date } | null
  payerName?: string | null
  isShared?: boolean | null
  splitMethod?: string | null
  paymentMethod?: string | null
  note?: string | null
}

/**
 * A single field that changed between before and after states.
 */
export interface ExpenseChange {
  /** Chinese human label for the field */
  label: string
  /** Formatted old value (for display) */
  from: string
  /** Formatted new value (for display) */
  to: string
}

// Canonical iteration order for stable multi-field diffs
type DiffableField = 'description' | 'amount' | 'category' | 'date' | 'payerName' | 'isShared' | 'splitMethod' | 'paymentMethod' | 'note'

const FIELD_LABELS: Record<DiffableField, string> = {
  description: '描述',
  amount: '金額',
  category: '類別',
  date: '日期',
  payerName: '付款人',
  isShared: '類型',
  splitMethod: '分帳方式',
  paymentMethod: '付款方式',
  note: '備註',
}

/**
 * Coerce a date-like value to a Date, or return null on failure.
 */
function toDateSafe(d: Date | { toDate(): Date } | null | undefined): Date | null {
  if (!d) return null
  try {
    if (d instanceof Date) return d
    if (typeof (d as { toDate?: unknown }).toDate === 'function') {
      return (d as { toDate(): Date }).toDate()
    }
  } catch {
    // best-effort
  }
  return null
}

/**
 * Normalize a nullable/undefined string to '' for comparison purposes.
 * null, undefined, and '' are all treated as equivalent (absent).
 */
function normalizeStr(v: string | null | undefined): string {
  return v ?? ''
}

/**
 * Format a value for display in the diff section.
 * Returns '（無）' when the value is absent.
 */
function formatValue(field: DiffableField, value: unknown): string {
  if (field === 'amount') {
    if (value === null || value === undefined) return '（無）'
    return `NT$ ${(value as number).toLocaleString('zh-TW')}`
  }
  if (field === 'date') {
    const formatted = formatEmailDate(value as Date | { toDate(): Date } | null | undefined)
    return formatted || '（無）'
  }
  if (field === 'isShared') {
    if (value === null || value === undefined) return '（無）'
    return (value as boolean) ? '共同' : '個人'
  }
  if (field === 'paymentMethod') {
    const s = normalizeStr(value as string | null | undefined)
    if (!s) return '（無）'
    return paymentLabel(s)
  }
  // String fields: description, category, payerName, splitMethod, note
  const s = normalizeStr(value as string | null | undefined)
  return s || '（無）'
}

/**
 * Compare before and after expense snapshots and return a list of changed
 * fields in stable iteration order. Splits are never included.
 *
 * Special handling:
 * - note: null / undefined / '' are all treated as equivalent (no change).
 * - date: compared via getTime() after coercion.
 * - amounts: strict number equality.
 */
export function diffExpense(before: ExpenseSnapshot, after: ExpenseSnapshot): ExpenseChange[] {
  const changes: ExpenseChange[] = []

  const fields: DiffableField[] = [
    'description',
    'amount',
    'category',
    'date',
    'payerName',
    'isShared',
    'splitMethod',
    'paymentMethod',
    'note',
  ]

  for (const field of fields) {
    const bv = before[field]
    const av = after[field]

    if (field === 'date') {
      // Compare via getTime() so different Timestamp objects for the same instant
      // don't produce a spurious diff
      const bd = toDateSafe(bv as Date | { toDate(): Date } | null | undefined)
      const ad = toDateSafe(av as Date | { toDate(): Date } | null | undefined)
      const bTime = bd ? bd.getTime() : null
      const aTime = ad ? ad.getTime() : null
      if (bTime === aTime) continue
      changes.push({
        label: FIELD_LABELS[field],
        from: formatValue(field, bv),
        to: formatValue(field, av),
      })
      continue
    }

    if (field === 'note') {
      // null / undefined / '' are all equivalent for note
      const bNorm = normalizeStr(bv as string | null | undefined)
      const aNorm = normalizeStr(av as string | null | undefined)
      if (bNorm === aNorm) continue
      changes.push({
        label: FIELD_LABELS[field],
        from: formatValue(field, bv),
        to: formatValue(field, av),
      })
      continue
    }

    if (field === 'amount') {
      const bn = bv as number | null | undefined
      const an = av as number | null | undefined
      if (bn === an) continue
      changes.push({
        label: FIELD_LABELS[field],
        from: formatValue(field, bv),
        to: formatValue(field, av),
      })
      continue
    }

    if (field === 'isShared') {
      const bb = bv as boolean | null | undefined
      const ab = av as boolean | null | undefined
      if (bb === ab) continue
      changes.push({
        label: FIELD_LABELS[field],
        from: formatValue(field, bv),
        to: formatValue(field, av),
      })
      continue
    }

    // String fields: description, category, payerName, splitMethod, paymentMethod
    const bStr = normalizeStr(bv as string | null | undefined)
    const aStr = normalizeStr(av as string | null | undefined)
    if (bStr === aStr) continue
    changes.push({
      label: FIELD_LABELS[field],
      from: formatValue(field, bv),
      to: formatValue(field, av),
    })
  }

  return changes
}
