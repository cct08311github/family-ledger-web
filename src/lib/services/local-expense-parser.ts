/**
 * 本地智能記帳解析引擎（免 API Key）
 * 移植自 Flutter local_expense_parser.dart
 */

export interface ParsedExpense {
  description: string
  amount: number
  category: string
  date: string // YYYY-MM-DD
}

// ── Chinese numeral conversion ────────────────────────────────

const CN_DIGITS: Record<string, number> = {
  零: 0, '〇': 0, 一: 1, 壹: 1, 二: 2, 貳: 2, 兩: 2,
  三: 3, 參: 3, 四: 4, 肆: 4, 五: 5, 伍: 5,
  六: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8,
  九: 9, 玖: 9, 十: 10, 拾: 10, 百: 100, 佰: 100,
  千: 1000, 仟: 1000, 萬: 10000, 万: 10000,
}

function chineseToNumber(cn: string): number {
  if (!cn) return 0
  let total = 0
  let current = 0
  let lastUnit = 1

  for (const char of cn) {
    const value = CN_DIGITS[char]
    if (value === undefined) continue
    if (value >= 10) {
      if (value === 10000) {
        total = (total + current) === 0 ? 10000 : (total + current) * 10000
        current = 0
        lastUnit = 10000
      } else {
        current = current === 0 ? value : current * value
        total += current
        current = 0
        lastUnit = value
      }
    } else {
      current = value
    }
  }
  if (current > 0) {
    total += lastUnit >= 100 && current < 10 ? current * (lastUnit / 10) : current
  }
  return total
}

// ── Amount extraction ─────────────────────────────────────────

function extractAmount(text: string): { amount: number; remaining: string } {
  // Require currency unit for arabic numbers to avoid matching unrelated quantities (e.g. "3個蘋果")
  const arabicWithUnitRe = /(\d+\.?\d*)[\s]*(元|塊|圓|NT\$?|NTD)/
  // Bare arabic (no unit) as fallback — only used when no chinese number found
  const arabicBareRe = /(\d+\.?\d*)/
  const cnRe = /([零〇一壹二貳兩三參四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万]+)[\s]*(元|塊|圓)?/

  const arabicUnitMatch = arabicWithUnitRe.exec(text)
  const cnMatch = cnRe.exec(text)

  // Prefer: (1) arabic+unit, (2) chinese number, (3) bare arabic
  if (arabicUnitMatch) {
    return { amount: parseFloat(arabicUnitMatch[1]) || 0, remaining: text.replace(arabicUnitMatch[0], ' ') }
  } else if (cnMatch) {
    const cnAmount = chineseToNumber(cnMatch[1])
    if (cnAmount > 0) return { amount: cnAmount, remaining: text.replace(cnMatch[0], ' ') }
  }
  // Last resort: bare arabic (e.g. "晚餐250")
  const bareMatch = arabicBareRe.exec(text)
  if (bareMatch) {
    return { amount: parseFloat(bareMatch[1]) || 0, remaining: text.replace(bareMatch[0], ' ') }
  }
  return { amount: 0, remaining: text }
}

// ── Date extraction ───────────────────────────────────────────

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function offsetDate(now: Date, days: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d
}

function extractDate(text: string, now: Date): { date: string | null; remaining: string } {
  const relMap: Record<string, number> = {
    今天: 0, 今日: 0, 昨天: -1, 昨日: -1, 前天: -2, 前日: -2, 大前天: -3, 大前日: -3,
  }
  for (const [key, offset] of Object.entries(relMap)) {
    if (text.includes(key)) {
      return { date: fmtDate(offsetDate(now, offset)), remaining: text.replace(key, ' ') }
    }
  }

  const lastWeekRe = /上[個]?(?:禮拜|週|星期)([一二三四五六日天])/
  const lwMatch = lastWeekRe.exec(text)
  if (lwMatch) {
    const dayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
    const target = dayMap[lwMatch[1]] ?? 1
    const d = new Date(now)
    d.setDate(d.getDate() - ((d.getDay() || 7) - target))
    if (d >= now) d.setDate(d.getDate() - 7)
    if ((now.getTime() - d.getTime()) / 86400000 < 7) d.setDate(d.getDate() - 7)
    return { date: fmtDate(d), remaining: text.replace(lwMatch[0], ' ') }
  }

  const thisWeekRe = /[這]?(?:禮拜|週|星期)([一二三四五六日天])/
  const twMatch = thisWeekRe.exec(text)
  if (twMatch) {
    const dayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
    const target = dayMap[twMatch[1]] ?? 1
    const d = new Date(now)
    d.setDate(d.getDate() - ((d.getDay() || 7) - target))
    if (d > now) d.setDate(d.getDate() - 7)
    return { date: fmtDate(d), remaining: text.replace(twMatch[0], ' ') }
  }

  const slashMatch = /(\d{1,2})\/(\d{1,2})/.exec(text)
  if (slashMatch) {
    const m = parseInt(slashMatch[1])
    const day = parseInt(slashMatch[2])
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      let year = now.getFullYear()
      if (new Date(year, m - 1, day) > now) year--
      return { date: fmtDate(new Date(year, m - 1, day)), remaining: text.replace(slashMatch[0], ' ') }
    }
  }

  const cnDateMatch = /(\d{1,2})月(\d{1,2})[日號]?/.exec(text)
  if (cnDateMatch) {
    const m = parseInt(cnDateMatch[1])
    const day = parseInt(cnDateMatch[2])
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      let year = now.getFullYear()
      if (new Date(year, m - 1, day) > now) year--
      return { date: fmtDate(new Date(year, m - 1, day)), remaining: text.replace(cnDateMatch[0], ' ') }
    }
  }

  return { date: null, remaining: text }
}

// ── Description extraction ────────────────────────────────────

function extractDescription(remaining: string, original: string): string {
  let desc = remaining
    .replace(/[花了用了付了繳了買了吃了搭了去了請了刷了]/g, '')
    .replace(/[花用付繳]了/g, '')
    .replace(/[的]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[元塊圓]$/g, '')
    .trim()

  if (desc.length < 2) {
    desc = original
      .replace(/\d+\.?\d*/g, '')
      .replace(/[零〇一壹二貳兩三參四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万]+/g, '')
      .replace(/今天|昨天|前天|大前天|上[個]?(?:禮拜|週|星期)./g, '')
      .replace(/[這]?(?:禮拜|週|星期)./g, '')
      .replace(/\d{1,2}[/月]\d{1,2}[日號]?/g, '')
      .replace(/[花了用了付了繳了買了吃了搭了去了請了刷了元塊圓]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return desc || original.trim()
}

// ── Category inference ────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  餐飲: [
    '早餐', '午餐', '晚餐', '宵夜', '吃飯', '便當', '麵', '飯', '餐',
    '咖啡', '奶茶', '飲料', '手搖', '飲品', '酒', '啤酒',
    '小吃', '火鍋', '燒烤', '壽司', '拉麵', '漢堡', '披薩',
    '滷味', '鹹酥雞', '雞排', '豆花', '甜點', '蛋糕', '麵包',
    '外送', '外賣', 'ubereats', 'foodpanda', '熊貓',
    '自助餐', '快餐', '速食', '麥當勞', '肯德基', '摩斯',
    '星巴克', '路易莎', '全聯', '超商', '全家',
    '食材', '買菜', '市場', '超市', '生鮮', '水果', '蔬菜',
    '請客', '聚餐', '尾牙', '春酒', '喜酒',
  ],
  交通: [
    '加油', '油錢', '油資', '汽油', '柴油',
    '停車', '停車費', '車位',
    '計程車', '小黃', 'taxi',
    '捷運', '公車', '客運', '火車', '高鐵', '台鐵',
    '機票', '船票', '車票', '月票', '悠遊卡', '一卡通',
    'etc', '過路費', '通行費', '國道',
    '修車', '保養', '洗車', '輪胎',
    '腳踏車', 'youbike', '機車',
  ],
  購物: [
    '購買', '網購', '蝦皮', 'momo', 'pchome', 'amazon',
    '衣服', '褲子', '鞋', '包包', '配件', '飾品',
    '手機', '電腦', '耳機', '平板',
    '家電', '電器', '冰箱', '洗衣機', '冷氣',
    '百貨', '商場', 'outlet', '特賣',
    '禮物', '送禮', '生日禮',
  ],
  房租: ['房租', '租金', '押金', '管理費', '大樓管理'],
  水電: ['水費', '電費', '瓦斯', '天然氣', '水電', '網路費', '寬頻', '第四台', '有線電視', '電話費', '手機費'],
  醫療: ['看醫生', '看診', '掛號', '門診', '急診', '藥局', '藥房', '買藥', '牙醫', '眼科', '皮膚科', '中醫', '復健', '健檢', '疫苗', '維他命'],
  娛樂: ['電影', '電影票', '影城', '唱歌', 'ktv', '卡拉ok', '遊戲', 'steam', '旅遊', '旅行', '住宿', '飯店', '民宿', '門票', '樂園', '展覽', '演唱會', '健身', '健身房', '按摩', 'spa', 'netflix', 'spotify', '訂閱'],
  孝親: ['孝親', '給爸', '給媽', '給父母', '爸媽', '紅包', '壓歲錢', '安養', '看護'],
  子女教育: ['學費', '補習', '才藝', '安親班', '教材', '課本', '文具', '書包', '幼兒園', '托兒', '家教', '線上課', '課程'],
  日用品: ['衛生紙', '洗衣精', '洗碗精', '牙膏', '牙刷', '洗髮', '沐浴', '肥皂', '清潔', '垃圾袋', '寵物', '飼料', '貓砂'],
  通訊: ['電話費', '網路費', '月租費', '儲值', '流量'],
  其他: [],
}

function inferCategory(fullText: string, description: string, available: string[]): string {
  const text = `${fullText} ${description}`.toLowerCase()
  let best = available[0] ?? '其他'
  let bestScore = 0
  for (const cat of available) {
    const kws = CATEGORY_KEYWORDS[cat]
    if (!kws) continue
    let score = 0
    for (const kw of kws) {
      if (text.includes(kw.toLowerCase())) score += kw.length
    }
    if (score > bestScore) { bestScore = score; best = cat }
  }
  return best
}

// ── Public API ────────────────────────────────────────────────

const FALLBACK_CATEGORIES = [
  '餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他',
]

export function parseExpense(
  text: string,
  availableCategories: string[] = FALLBACK_CATEGORIES,
): ParsedExpense {
  const input = text.trim()
  const now = new Date()

  const { date, remaining: r1 } = extractDate(input, now)
  const { amount, remaining: r2 } = extractAmount(r1)
  const description = extractDescription(r2, input)
  const category = inferCategory(input, description, availableCategories)

  return {
    description: description || input,
    amount,
    category,
    date: date ?? fmtDate(now),
  }
}
