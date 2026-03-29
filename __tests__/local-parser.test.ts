/**
 * Unit tests for local-expense-parser.ts
 * Ported from Flutter: test/local_parser_test.dart
 * 25 tests covering: arabic amounts, chinese numerals, category inference,
 * date parsing (relative + absolute), description extraction, compound scenarios.
 */

import { parseExpense } from '@/lib/services/local-expense-parser'

const categories = ['餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他']

function p(text: string) {
  return parseExpense(text, categories)
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 阿拉伯數字金額 ─────────────────────────────────────

describe('阿拉伯數字金額', () => {
  test('基本', () => {
    expect(p('午餐250').amount).toBe(250)
    expect(p('咖啡85').amount).toBe(85)
    expect(p('停車費60').amount).toBe(60)
  })

  test('帶元/塊', () => {
    expect(p('加油1500元').amount).toBe(1500)
    expect(p('買菜500塊').amount).toBe(500)
  })

  test('帶空格', () => {
    expect(p('晚餐 300').amount).toBe(300)
  })
})

// ── 中文數字金額 ──────────────────────────────────────

describe('中文數字金額', () => {
  test('簡單', () => {
    expect(p('晚餐三百').amount).toBe(300)
    expect(p('咖啡八十五').amount).toBe(85)
  })

  test('千', () => {
    expect(p('加油一千五').amount).toBe(1500)
    expect(p('手機兩千').amount).toBe(2000)
  })

  test('萬', () => {
    expect(p('房租兩萬五').amount).toBe(25000)
  })

  test('百+簡寫', () => {
    expect(p('計程車兩百五').amount).toBe(250)
    expect(p('水電費三千二').amount).toBe(3200)
  })

  test('複合', () => {
    expect(p('補習費一萬五千').amount).toBe(15000)
  })

  test('十', () => {
    expect(p('飲料五十').amount).toBe(50)
  })
})

// ── 類別推斷 ──────────────────────────────────────────

describe('類別推斷', () => {
  test('餐飲', () => {
    expect(p('午餐便當100').category).toBe('餐飲')
    expect(p('星巴克咖啡180').category).toBe('餐飲')
    expect(p('外送300').category).toBe('餐飲')
  })

  test('交通', () => {
    expect(p('加油1500').category).toBe('交通')
    expect(p('停車費60').category).toBe('交通')
    expect(p('搭捷運35').category).toBe('交通')
    expect(p('計程車兩百五').category).toBe('交通')
  })

  test('醫療', () => {
    expect(p('看醫生掛號250').category).toBe('醫療')
    expect(p('買藥300').category).toBe('醫療')
  })

  test('娛樂', () => {
    expect(p('看電影350').category).toBe('娛樂')
    expect(p('Netflix訂閱390').category).toBe('娛樂')
  })

  test('水電', () => {
    expect(p('電費2300').category).toBe('水電')
    expect(p('繳水費800').category).toBe('水電')
  })
})

// ── 日期解析 ──────────────────────────────────────────

describe('日期解析', () => {
  test('今天', () => {
    expect(p('今天午餐100').date).toBe(fmtDate(new Date()))
  })

  test('昨天', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(p('昨天晚餐300').date).toBe(fmtDate(yesterday))
  })

  test('前天', () => {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    expect(p('前天加油1000').date).toBe(fmtDate(d))
  })

  test('MM/DD', () => {
    expect(p('3/15看醫生800').date).toMatch(/-03-15$/)
  })
})

// ── 描述提取 ──────────────────────────────────────────

describe('描述提取', () => {
  test('基本', () => {
    expect(p('午餐250').description).toContain('午餐')
    expect(p('加油花了1500').description).toContain('加油')
  })

  test('含動詞', () => {
    expect(p('昨天買菜500').description).toContain('菜')
  })
})

// ── 綜合場景 ──────────────────────────────────────────

describe('綜合場景', () => {
  test('完整語句', () => {
    const r = p('昨天晚餐花了三百')
    expect(r.amount).toBe(300)
    expect(r.category).toBe('餐飲')
    expect(r.description.length).toBeGreaterThan(0)
  })

  test('搭計程車兩百五', () => {
    const r = p('搭計程車兩百五')
    expect(r.amount).toBe(250)
    expect(r.category).toBe('交通')
  })

  test('繳房租兩萬五', () => {
    const r = p('繳房租兩萬五')
    expect(r.amount).toBe(25000)
    expect(r.category).toBe('房租')
  })

  test('星巴克咖啡180', () => {
    const r = p('星巴克咖啡180')
    expect(r.amount).toBe(180)
    expect(r.category).toBe('餐飲')
  })

  test('3/15看醫生八百', () => {
    const r = p('3/15看醫生八百')
    expect(r.amount).toBe(800)
    expect(r.category).toBe('醫療')
    expect(r.date).toMatch(/-03-15$/)
  })
})
