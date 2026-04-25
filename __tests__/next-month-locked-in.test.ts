import { forecastNextMonthLockedIn } from '@/lib/next-month-locked-in'
import type { RecurringExpense } from '@/lib/types'

const NOW = new Date(2026, 3, 15, 12, 0, 0).getTime() // April 15, 2026 → next month = May 2026

interface TemplateOpts {
  id?: string
  description?: string
  amount?: number | null
  category?: string
  frequency?: 'monthly' | 'weekly' | 'yearly'
  dayOfMonth?: number
  dayOfWeek?: number
  monthOfYear?: number
  isPaused?: boolean
  endDate?: Date | null
}

function mk(opts: TemplateOpts = {}): RecurringExpense {
  const start = new Date(2025, 0, 1)
  return {
    id: opts.id ?? 't',
    groupId: 'g1',
    description: opts.description ?? 'rent',
    amount: 'amount' in opts ? opts.amount : 15000,
    category: opts.category ?? '房租',
    payerId: 'm1',
    payerName: '爸',
    isShared: true,
    splitMethod: 'equal',
    splits: [],
    paymentMethod: 'cash',
    frequency: opts.frequency ?? 'monthly',
    dayOfMonth: opts.dayOfMonth ?? 1,
    dayOfWeek: opts.dayOfWeek,
    monthOfYear: opts.monthOfYear,
    startDate: start,
    endDate: opts.endDate ?? null,
    isPaused: opts.isPaused ?? false,
    createdBy: 'u1',
  } as unknown as RecurringExpense
}

describe('forecastNextMonthLockedIn', () => {
  it('returns null when no templates', () => {
    expect(forecastNextMonthLockedIn({ recurringTemplates: [], now: NOW })).toBeNull()
  })

  it('returns null when all templates are paused', () => {
    const templates = [mk({ isPaused: true })]
    expect(forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })).toBeNull()
  })

  it('finds monthly template occurrence in next month', () => {
    // Today = April 15. Next month = May. Template fires on day 1.
    const templates = [mk({ id: 'rent', dayOfMonth: 1, amount: 15000 })]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r!.monthLabel).toBe('2026-05')
    expect(r!.count).toBe(1)
    expect(r!.totalEstimated).toBe(15000)
    expect(r!.items[0].expectedDate).toBe('2026-05-01')
    expect(r!.items[0].description).toBe('rent')
  })

  it('finds weekly template multiple occurrences', () => {
    // Weekly on Monday → 5 Mondays in May 2026: 5/4, 5/11, 5/18, 5/25
    const templates = [
      mk({
        id: 'gym',
        description: 'gym',
        amount: 500,
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: undefined,
      }),
    ]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r!.count).toBe(4) // 4 Mondays in May 2026
    expect(r!.totalEstimated).toBe(500 * 4)
  })

  it('skips template ending before next month', () => {
    const endApril = new Date(2026, 3, 30)
    const templates = [mk({ id: 'old', endDate: endApril })]
    expect(forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })).toBeNull()
  })

  it('keeps template ending after next month starts', () => {
    const endMay = new Date(2026, 4, 31)
    const templates = [mk({ id: 'rent', endDate: endMay })]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r!.count).toBe(1)
  })

  it('variable amount templates included in items but not total', () => {
    const templates = [
      mk({ id: 'rent', amount: 15000 }),
      mk({ id: 'utility', amount: null, description: '水費' }),
    ]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r!.items.length).toBe(2)
    expect(r!.count).toBe(1) // fixed-amount only
    expect(r!.variableCount).toBe(1)
    expect(r!.totalEstimated).toBe(15000)
    const variable = r!.items.find((i) => i.templateId === 'utility')
    expect(variable!.amount).toBeNull()
  })

  it('totalEstimated null when all items are variable amount', () => {
    const templates = [mk({ id: 'utility', amount: null, description: '水費' })]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r!.totalEstimated).toBeNull()
    expect(r!.variableCount).toBe(1)
    expect(r!.count).toBe(0)
  })

  it('sorts items chronologically', () => {
    const templates = [
      mk({ id: 'late', dayOfMonth: 25, description: '補習' }),
      mk({ id: 'early', dayOfMonth: 1, description: 'rent' }),
      mk({ id: 'mid', dayOfMonth: 15, description: 'spotify' }),
    ]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r!.items.map((i) => i.description)).toEqual(['rent', 'spotify', '補習'])
  })

  it('handles end-of-month edge (dayOfMonth=31 in 30-day month)', () => {
    // June has 30 days. Template dayOfMonth=31 → fires on June 30
    const may15 = new Date(2026, 4, 15, 12, 0, 0).getTime()
    const templates = [mk({ id: 'eom', dayOfMonth: 31 })]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: may15 })
    expect(r!.items[0].expectedDate).toBe('2026-06-30')
  })

  it('graceful with bad endDate', () => {
    const templates = [{
      ...mk({ id: 'rent' }),
      endDate: 'oops',
    } as unknown as RecurringExpense]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    expect(r).not.toBeNull()
    expect(r!.count).toBe(1)
  })

  it('mixes weekly and monthly templates', () => {
    const templates = [
      mk({ id: 'rent', dayOfMonth: 1, amount: 15000 }),
      mk({
        id: 'gym',
        amount: 500,
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: undefined,
      }),
    ]
    const r = forecastNextMonthLockedIn({ recurringTemplates: templates, now: NOW })
    // 1 monthly + 4 weekly = 5
    expect(r!.items.length).toBe(5)
    expect(r!.totalEstimated).toBe(15000 + 500 * 4)
  })
})
