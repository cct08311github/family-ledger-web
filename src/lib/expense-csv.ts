/**
 * CSV export for the records page. Pure helpers only — UI binds the download.
 * Issue #207.
 *
 * Design choices:
 *   - UTF-8 BOM so Excel/Numbers auto-detect encoding (Chinese columns + data)
 *   - Date rendered YYYY-MM-DD, locale-independent (spreadsheet apps parse it
 *     as a real Date regardless of user locale)
 *   - Leading `=` `+` `-` `@` get a single-quote prefix to neutralise the
 *     CSV-injection / formula-attack vector (see OWASP "CSV Injection")
 */

// Shape the helper cares about — decoupled from the full Expense type so we
// don't pull Firestore Timestamp imports into a pure-math module.
export interface CSVExpense {
  date: Date | { toDate: () => Date } | null | undefined
  description: string
  amount: number
  category: string
  payerName: string
  isShared: boolean
  paymentMethod: string
  note?: string | null
}

export const CSV_BOM = '\uFEFF'
export const CSV_HEADER = '日期,描述,金額,類別,付款人,類型,付款方式,備註'

const FORMULA_LEAD = /^[=+\-@]/

function coerceDate(d: CSVExpense['date']): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  if (typeof d === 'object' && typeof (d as { toDate?: unknown }).toDate === 'function') {
    try {
      return (d as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }
  return null
}

function formatDate(d: Date | null): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    // Numbers don't need quoting but must not be NaN/Infinity
    if (!Number.isFinite(value)) return ''
    return String(value)
  }
  let s = String(value)
  // Defuse CSV formula injection before any other quoting logic.
  if (FORMULA_LEAD.test(s)) s = `'${s}`
  const needsQuote = /[",\n\r]/.test(s) || s.startsWith("'")
  if (!needsQuote) return s
  return `"${s.replace(/"/g, '""')}"`
}

export function expensesToCSV(expenses: readonly CSVExpense[]): string {
  const lines: string[] = [CSV_HEADER]
  for (const e of expenses) {
    lines.push(
      [
        formatDate(coerceDate(e.date)),
        e.description,
        e.amount,
        e.category,
        e.payerName,
        e.isShared ? '共同' : '個人',
        typeof e.paymentMethod === 'string' ? e.paymentMethod : '',
        e.note ?? '',
      ]
        .map(escapeCSVCell)
        .join(','),
    )
  }
  return CSV_BOM + lines.join('\n') + '\n'
}

/**
 * Build a default filename for the download: `家計本-YYYY-MM-DD.csv`.
 */
export function buildCSVFilename(now: Date = new Date()): string {
  return `家計本-${formatDate(now)}.csv`
}
