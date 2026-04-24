import {
  categoryColor,
  categoryPaletteIndex,
  CATEGORY_PALETTE,
  CATEGORY_FG_PALETTE,
} from '@/lib/category-color'

describe('categoryPaletteIndex', () => {
  it('returns 0 for empty/null/undefined', () => {
    expect(categoryPaletteIndex(undefined)).toBe(0)
    expect(categoryPaletteIndex(null)).toBe(0)
    expect(categoryPaletteIndex('')).toBe(0)
    expect(categoryPaletteIndex('   ')).toBe(0)
  })

  it('is deterministic (same name → same index)', () => {
    expect(categoryPaletteIndex('餐飲')).toBe(categoryPaletteIndex('餐飲'))
    expect(categoryPaletteIndex('Groceries')).toBe(categoryPaletteIndex('Groceries'))
  })

  it('normalizes whitespace and case (equivalent keys collide)', () => {
    expect(categoryPaletteIndex('餐飲')).toBe(categoryPaletteIndex(' 餐飲 '))
    expect(categoryPaletteIndex('Food')).toBe(categoryPaletteIndex('FOOD'))
    expect(categoryPaletteIndex('Food')).toBe(categoryPaletteIndex('food'))
  })

  it('returns a valid palette index', () => {
    for (const name of ['餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他', 'Starbucks', 'X']) {
      const i = categoryPaletteIndex(name)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(CATEGORY_PALETTE.length)
    }
  })

  it('distributes across palette slots reasonably (not all zero)', () => {
    const names = ['餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他']
    const indices = new Set(names.map(categoryPaletteIndex))
    // With 12 inputs across 12 slots, expect at least 5 distinct hits
    expect(indices.size).toBeGreaterThanOrEqual(5)
  })
})

describe('categoryColor', () => {
  it('returns both bg and fg from palette', () => {
    const c = categoryColor('餐飲')
    expect(CATEGORY_PALETTE).toContain(c.bg)
    expect(CATEGORY_FG_PALETTE).toContain(c.fg)
  })

  it('bg and fg come from the same palette slot', () => {
    const i = categoryPaletteIndex('餐飲')
    expect(categoryColor('餐飲').bg).toBe(CATEGORY_PALETTE[i])
    expect(categoryColor('餐飲').fg).toBe(CATEGORY_FG_PALETTE[i])
  })

  it('empty/null defaults to slot 0', () => {
    const c = categoryColor('')
    expect(c.bg).toBe(CATEGORY_PALETTE[0])
    expect(c.fg).toBe(CATEGORY_FG_PALETTE[0])
  })
})

describe('palette shape invariants', () => {
  it('bg and fg arrays have matching length', () => {
    expect(CATEGORY_PALETTE.length).toBe(CATEGORY_FG_PALETTE.length)
  })

  it('palette has at least 8 colours for enough variety', () => {
    expect(CATEGORY_PALETTE.length).toBeGreaterThanOrEqual(8)
  })
})
