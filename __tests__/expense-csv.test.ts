import {
  expensesToCSV,
  escapeCSVCell,
  CSV_BOM,
  CSV_HEADER,
  type CSVExpense,
} from '@/lib/expense-csv'

// Helper: build a minimal expense shaped like the CSV function expects.
// Keeps tests decoupled from the full Expense type (Firestore Timestamp, splits, etc.).
function e(overrides: Partial<CSVExpense> = {}): CSVExpense {
  return {
    date: new Date(2026, 3, 10), // 2026-04-10
    description: 'lunch',
    amount: 150,
    category: 'food',
    payerName: 'Alice',
    isShared: true,
    paymentMethod: 'cash',
    note: undefined,
    ...overrides,
  }
}

describe('escapeCSVCell', () => {
  it('passes through simple strings', () => {
    expect(escapeCSVCell('hello')).toBe('hello')
  })

  it('quotes strings that contain commas', () => {
    expect(escapeCSVCell('a,b')).toBe('"a,b"')
  })

  it('quotes strings that contain double quotes and doubles the quote char', () => {
    expect(escapeCSVCell('she said "hi"')).toBe('"she said ""hi"""')
  })

  it('quotes strings containing newlines', () => {
    expect(escapeCSVCell('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCSVCell('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  it('coerces number to string without quoting', () => {
    expect(escapeCSVCell(150)).toBe('150')
  })

  it('coerces null / undefined to empty', () => {
    expect(escapeCSVCell(null)).toBe('')
    expect(escapeCSVCell(undefined)).toBe('')
  })

  it('handles CSV-bomb patterns defensively (leading = + - @)', () => {
    // Excel/Sheets formula injection: cells starting with = + - @ get evaluated
    // as formulas. Prefix with single-quote to neutralize.
    expect(escapeCSVCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`)
    expect(escapeCSVCell('+1234')).toBe(`"'+1234"`)
    expect(escapeCSVCell('-1234')).toBe(`"'-1234"`)
    expect(escapeCSVCell('@alias')).toBe(`"'@alias"`)
  })
})

describe('expensesToCSV', () => {
  it('starts with UTF-8 BOM for Excel auto-detection', () => {
    const csv = expensesToCSV([])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
  })

  it('writes the fixed header after the BOM', () => {
    const csv = expensesToCSV([])
    expect(csv).toBe(CSV_BOM + CSV_HEADER + '\n')
  })

  it('writes one row per expense in order', () => {
    const csv = expensesToCSV([
      e({ description: 'apple', amount: 100 }),
      e({ description: 'banana', amount: 50 }),
    ])
    const lines = csv.slice(CSV_BOM.length).split('\n')
    // [0] = header, [1..n] = rows
    expect(lines[1]).toContain('apple')
    expect(lines[1]).toContain('100')
    expect(lines[2]).toContain('banana')
    expect(lines[2]).toContain('50')
  })

  it('formats date as YYYY-MM-DD (locale-independent)', () => {
    const csv = expensesToCSV([e({ date: new Date(2026, 3, 5) })])
    expect(csv).toContain('2026-04-05')
  })

  it('accepts a Firestore Timestamp-like (has toDate())', () => {
    const fakeTs = { toDate: () => new Date(2026, 3, 10) }
    // @ts-expect-error — simulate Firestore Timestamp duck type
    const csv = expensesToCSV([e({ date: fakeTs })])
    expect(csv).toContain('2026-04-10')
  })

  it('escapes description containing commas + quotes', () => {
    const csv = expensesToCSV([e({ description: 'a,b "c"' })])
    expect(csv).toContain('"a,b ""c"""')
  })

  it('renders isShared as 共同 / 個人', () => {
    const shared = expensesToCSV([e({ isShared: true })])
    const personal = expensesToCSV([e({ isShared: false })])
    expect(shared).toContain('共同')
    expect(personal).toContain('個人')
  })

  it('renders empty note as blank, not "undefined" string', () => {
    const csv = expensesToCSV([e({ note: undefined })])
    const fields = csv.trim().split('\n').at(-1)!.split(',')
    expect(fields.at(-1)).toBe('') // trailing note column
  })

  it('defends against formula-injection in description / note / payerName', () => {
    const csv = expensesToCSV([
      e({ description: '=HYPERLINK("evil.com")', note: '+cmd|"/c calc"!A1', payerName: '@admin' }),
    ])
    // All three suspicious leads should be prefixed with single-quote inside
    // a quoted field — strings like `"'=HYPERLINK(...)"` appear in the output.
    expect(csv).toContain(`"'=HYPERLINK(""evil.com"")"`)
    expect(csv).toContain(`"'+cmd|""/c calc""!A1"`)
    expect(csv).toContain(`"'@admin"`)
  })

  it('coerces unknown payment method to empty (schema-agnostic)', () => {
    // @ts-expect-error — deliberately exotic value
    const csv = expensesToCSV([e({ paymentMethod: null })])
    const row = csv.trim().split('\n').at(-1)!
    // payment column is position 6 (0-indexed); just ensure no "null" leak
    expect(row).not.toContain('null')
  })
})
