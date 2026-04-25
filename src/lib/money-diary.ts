/**
 * Money Diary — narrative summary of a month's spending (Issue #282).
 *
 * Pulls human-shaped facts out of raw expenses and composes them into 5-7
 * sentences that read like a journal entry, not a dashboard. Each fact is
 * extracted independently and the composer skips sentences whose data is
 * absent — so a sparse month produces a short diary instead of awkward
 * filler. No LLM, no external services. Pure functions, deterministic.
 */
import { toDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

export interface DiaryFact {
  /** Total spending in the month and delta vs previous month (null if no prev data). */
  totals: { current: number; previous: number | null; deltaPct: number | null }
  /** The single largest expense in the month, if any. */
  largest: Expense | null
  /** Most-used category by frequency (count). */
  topByCount: { category: string; count: number; total: number } | null
  /** Categories that appear this month but never in any earlier month from the dataset. */
  newCategories: { category: string; count: number; total: number }[]
  /** Day with the highest single-day total. */
  busiestDay: { dateKey: string; total: number; count: number } | null
  /** Number of expenses in the month. */
  expenseCount: number
}

interface ExtractInput {
  /** Expenses occurring in the selected month. */
  monthExpenses: readonly Expense[]
  /** All expenses prior to the selected month (used to detect "new" categories). */
  earlierExpenses: readonly Expense[]
  /** Total spending in the previous calendar month, or null when unavailable. */
  previousMonthTotal: number | null
}

function safeDate(e: Expense): Date | null {
  try {
    const d = toDate(e.date)
    return Number.isFinite(d.getTime()) ? d : null
  } catch {
    return null
  }
}

function sumAmount(expenses: readonly Expense[]): number {
  let total = 0
  for (const e of expenses) {
    if (typeof e.amount === 'number' && Number.isFinite(e.amount)) total += e.amount
  }
  return total
}

export function extractDiaryFacts(input: ExtractInput): DiaryFact {
  const { monthExpenses, earlierExpenses, previousMonthTotal } = input

  // ── totals ──────────────────────────────────────────────────────
  const current = sumAmount(monthExpenses)
  let deltaPct: number | null = null
  if (previousMonthTotal !== null && previousMonthTotal > 0) {
    deltaPct = Math.round(((current - previousMonthTotal) / previousMonthTotal) * 100)
  }

  // ── largest expense ─────────────────────────────────────────────
  let largest: Expense | null = null
  for (const e of monthExpenses) {
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    if (!largest || e.amount > largest.amount) largest = e
  }

  // ── top by count + new categories ──────────────────────────────
  const monthCatCount = new Map<string, { count: number; total: number }>()
  for (const e of monthExpenses) {
    if (!e.category) continue
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    const cur = monthCatCount.get(e.category) ?? { count: 0, total: 0 }
    cur.count += 1
    cur.total += e.amount
    monthCatCount.set(e.category, cur)
  }

  const earlierCats = new Set<string>()
  for (const e of earlierExpenses) {
    if (e.category) earlierCats.add(e.category)
  }

  let topByCount: DiaryFact['topByCount'] = null
  for (const [category, info] of monthCatCount) {
    if (!topByCount || info.count > topByCount.count) {
      topByCount = { category, ...info }
    }
  }

  const newCategories: DiaryFact['newCategories'] = []
  for (const [category, info] of monthCatCount) {
    if (!earlierCats.has(category)) {
      newCategories.push({ category, ...info })
    }
  }
  newCategories.sort((a, b) => b.total - a.total)

  // ── busiest day ─────────────────────────────────────────────────
  const byDay = new Map<string, { total: number; count: number }>()
  for (const e of monthExpenses) {
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) continue
    const d = safeDate(e)
    if (!d) continue
    const key = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    const cur = byDay.get(key) ?? { total: 0, count: 0 }
    cur.total += e.amount
    cur.count += 1
    byDay.set(key, cur)
  }
  let busiestDay: DiaryFact['busiestDay'] = null
  for (const [dateKey, info] of byDay) {
    if (!busiestDay || info.total > busiestDay.total) {
      busiestDay = { dateKey, ...info }
    }
  }

  return {
    totals: { current, previous: previousMonthTotal, deltaPct },
    largest,
    topByCount,
    newCategories,
    busiestDay,
    expenseCount: monthExpenses.filter(
      (e) => typeof e.amount === 'number' && Number.isFinite(e.amount),
    ).length,
  }
}

function formatCurrency(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString('zh-TW')}`
}

/**
 * Compose facts into ordered paragraphs. Each entry is one sentence; caller
 * renders them as separate <p> elements. Sentences whose underlying fact is
 * missing are dropped so a sparse month yields a short diary.
 */
export function composeDiarySentences(
  facts: DiaryFact,
  selectedMonth: { year: number; month: number },
): string[] {
  if (facts.expenseCount === 0) return []

  const lines: string[] = []
  const monthLabel = `${selectedMonth.year} 年 ${selectedMonth.month + 1} 月`

  // 1. totals + delta
  if (facts.totals.deltaPct === null) {
    lines.push(`${monthLabel}你們花了 ${formatCurrency(facts.totals.current)}，共 ${facts.expenseCount} 筆記錄。`)
  } else {
    const direction = facts.totals.deltaPct > 0 ? '多花' : '少花'
    const abs = Math.abs(facts.totals.deltaPct)
    if (abs === 0) {
      lines.push(`${monthLabel}花了 ${formatCurrency(facts.totals.current)}，與上月持平。`)
    } else {
      const diff = facts.totals.previous !== null
        ? Math.abs(facts.totals.current - facts.totals.previous)
        : null
      const diffText = diff !== null ? ` — ${direction === '多花' ? '多了' : '省了'} ${formatCurrency(diff)}` : ''
      lines.push(
        `${monthLabel}你們花了 ${formatCurrency(facts.totals.current)}，比上月${direction} ${abs}%${diffText}。`,
      )
    }
  }

  // 2. largest expense
  if (facts.largest) {
    let dateText = ''
    const d = safeDate(facts.largest)
    if (d) dateText = `${d.getMonth() + 1}/${d.getDate()} `
    const cat = facts.largest.category ? `（${facts.largest.category}）` : ''
    lines.push(
      `最大一筆：${facts.largest.payerName} ${dateText}記了「${facts.largest.description}」${formatCurrency(facts.largest.amount)}${cat}。`,
    )
  }

  // 3. top by count
  if (facts.topByCount && facts.topByCount.count >= 2) {
    lines.push(
      `${facts.topByCount.category}記了 ${facts.topByCount.count} 次（共 ${formatCurrency(facts.topByCount.total)}），是本月最頻繁的類別。`,
    )
  }

  // 4. new categories (cap at 2 to avoid wall of text)
  if (facts.newCategories.length > 0) {
    const top = facts.newCategories.slice(0, 2)
    if (top.length === 1) {
      lines.push(
        `本月第一次出現「${top[0].category}」（${formatCurrency(top[0].total)}，${top[0].count} 筆）。`,
      )
    } else {
      lines.push(
        `本月第一次出現的類別：「${top[0].category}」與「${top[1].category}」。`,
      )
    }
  }

  // 5. busiest day
  if (facts.busiestDay && facts.busiestDay.count >= 2) {
    lines.push(
      `${facts.busiestDay.dateKey} 是花最多的一天：${formatCurrency(facts.busiestDay.total)}（${facts.busiestDay.count} 筆）。`,
    )
  }

  return lines
}
