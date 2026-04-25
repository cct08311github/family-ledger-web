import { toDate } from './utils'
import type { Expense } from './types'

export interface MonthlyReportData {
  /** Multi-line shareable text. */
  text: string
  /** Total amount in this month. */
  total: number
  /** Total count in this month. */
  count: number
  hasData: boolean
}

interface GenerateOptions {
  expenses: Expense[]
  year: number
  /** 0-indexed month. */
  month: number
  /** Previous month total for delta calculation. null when unavailable. */
  previousMonthTotal?: number | null
}

function fmtCurrency(amount: number): string {
  return `NT$${Math.round(amount).toLocaleString('en-US')}`
}

/**
 * Generate a formatted month-summary text suitable for LINE / WhatsApp /
 * Telegram sharing. Pure function — caller wires it to navigator.share or
 * clipboard.
 */
export function generateMonthlyReport({
  expenses,
  year,
  month,
  previousMonthTotal,
}: GenerateOptions): MonthlyReportData {
  let total = 0
  let count = 0
  let biggest: { description: string; amount: number } | null = null
  const byCategory = new Map<string, number>()

  for (const e of expenses) {
    const amount = Number(e.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    let d: Date
    try {
      d = toDate(e.date)
    } catch {
      continue
    }
    if (!Number.isFinite(d.getTime())) continue
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    total += amount
    count++
    const category = (e.category || '其他').trim() || '其他'
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount)
    const description = (e.description || '(無描述)').trim() || '(無描述)'
    if (!biggest || amount > biggest.amount) {
      biggest = { description, amount }
    }
  }

  if (count === 0) {
    return { text: '', total: 0, count: 0, hasData: false }
  }

  const monthLabel = `${year}/${String(month + 1).padStart(2, '0')}`
  const lines: string[] = []
  lines.push(`📊 ${monthLabel} 家計月報`)
  lines.push('')
  lines.push(`💰 總支出：${fmtCurrency(total)}（${count} 筆）`)

  if (
    typeof previousMonthTotal === 'number' &&
    Number.isFinite(previousMonthTotal) &&
    previousMonthTotal > 0
  ) {
    const delta = total - previousMonthTotal
    const pct = Math.round((delta / previousMonthTotal) * 100)
    if (delta > 0) {
      lines.push(`📈 比上月多 ${fmtCurrency(delta)} (+${pct}%)`)
    } else if (delta < 0) {
      lines.push(`📉 比上月少 ${fmtCurrency(Math.abs(delta))} (${pct}%)`)
    } else {
      lines.push(`➖ 與上月相當`)
    }
  }

  if (biggest) {
    lines.push('')
    lines.push(`🏆 最大筆：${fmtCurrency(biggest.amount)}（${biggest.description}）`)
  }

  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  if (topCategories.length > 0) {
    lines.push('')
    lines.push('📂 主要類別：')
    topCategories.forEach(([cat, amt], i) => {
      const pct = Math.round((amt / total) * 100)
      lines.push(`${i + 1}. ${cat} ${fmtCurrency(amt)} (${pct}%)`)
    })
  }

  return {
    text: lines.join('\n'),
    total,
    count,
    hasData: true,
  }
}
