/**
 * 本地智能記帳解析引擎（免 API Key）
 * 實作源自 @family-ledger/domain (shared package).
 * TODO: migrate to re-export from '@family-ledger/domain' once Turbopack workspace issue resolved.
 */

export interface ParsedExpense {
  description: string
  amount: number
  category: string
  date: string // YYYY-MM-DD
}

const CN_DIGITS: Record<string, number> = {
  零: 0, '〇': 0, 一: 1, 壹: 1, 二: 2, 貳: 2, 兩: 2,
  三: 3, 參: 3, 四: 4, 肆: 4, 五: 5, 伍: 5,
  六: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8,
  九: 9, 玖: 9, 十: 10, 拾: 10, 百: 100, 佰: 100,
  千: 1000, 仟: 1000, 萬: 10000, 万: 10000,
}

function chineseToNumber(cn: string): number {
  if (!cn) return 0
  let total = 0; let current = 0; let lastUnit = 1
  for (const char of cn) {
    const value = CN_DIGITS[char]
    if (value === undefined) continue
    if (value >= 10) {
      if (value === 10000) {
        total = (total + current) === 0 ? 10000 : (total + current) * 10000
        current = 0; lastUnit = 10000
      } else {
        current = current === 0 ? value : current * value
        total += current; current = 0; lastUnit = value
      }
    } else { current = value }
  }
  if (current > 0) {
    total += lastUnit >= 100 && current < 10 ? current * (lastUnit / 10) : current
  }
  return total
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extractAmount(text: string): { amount: number; remaining: string } {
  const arabicWithUnitRe = /(\d+\.?\d*)[\s]*(元|塊|圓|NT\$?|NTD)/
  const arabicBareRe = /(\d+\.?\d*)/
  const cnRe = /([零〇一壹二貳兩三參四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万]+)[\s]*(元|塊|圓)?/
  const arabicUnitMatch = arabicWithUnitRe.exec(text)
  const cnMatch = cnRe.exec(text)
  if (arabicUnitMatch) return { amount: parseFloat(arabicUnitMatch[1]) || 0, remaining: text.replace(arabicUnitMatch[0], ' ') }
  if (cnMatch) { const cnAmt = chineseToNumber(cnMatch[1]); if (cnAmt > 0) return { amount: cnAmt, remaining: text.replace(cnMatch[0], ' ') } }
  const bareMatch = arabicBareRe.exec(text)
  if (bareMatch) return { amount: parseFloat(bareMatch[1]) || 0, remaining: text.replace(bareMatch[0], ' ') }
  return { amount: 0, remaining: text }
}

function extractDate(text: string, now: Date): { date: string | null; remaining: string } {
  const relMap: Record<string, number> = { 今天: 0, 今日: 0, 昨天: -1, 昨日: -1, 前天: -2, 前日: -2, 大前天: -3, 大前日: -3 }
  for (const [key, offset] of Object.entries(relMap)) {
    if (text.includes(key)) {
      const d = new Date(now); d.setDate(d.getDate() + offset)
      return { date: fmtDate(d), remaining: text.replace(key, ' ') }
    }
  }
  const slashMatch = /(\d{1,2})\/(\d{1,2})/.exec(text)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]), day = parseInt(slashMatch[2])
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      let year = now.getFullYear()
      if (new Date(year, m - 1, day) > now) year--
      return { date: fmtDate(new Date(year, m - 1, day)), remaining: text.replace(slashMatch[0], ' ') }
    }
  }
  return { date: null, remaining: text }
}

function extractDescription(remaining: string, original: string): string {
  let desc = remaining.replace(/[花了用了付了繳了買了吃了搭了去了請了刷了]/g, '')
    .replace(/[花用付繳]了/g, '').replace(/[的]$/g, '').replace(/\s+/g, ' ').trim()
    .replace(/[元塊圓]$/g, '').trim()
  if (desc.length < 2) {
    desc = original.replace(/\d+\.?\d*/g, '').replace(/[零〇一壹二貳兩三參四肆五伍六陸七柒八捌九玖十拾百佰千仟萬万]+/g, '')
      .replace(/今天|昨天|前天|大前天|上[個]?(?:禮拜|週|星期)./g, '')
      .replace(/[這]?(?:禮拜|週|星期)./g, '').replace(/\d{1,2}[/月]\d{1,2}[日號]?/g, '')
      .replace(/[花了用了付了繳了買了吃了搭了去了請了刷了元塊圓]/g, '').replace(/\s+/g, ' ').trim()
  }
  return desc || original.trim()
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  餐飲: ['早餐','午餐','晚餐','宵夜','吃飯','便當','麵','飯','餐','咖啡','奶茶','飲料','手搖','小吃','外送','ubereats','foodpanda','全聯','超商','全家','請客','聚餐'],
  交通: ['加油','停車','計程車','捷運','公車','火車','高鐵','機票','月票','悠遊卡','過路費','修車','保養','youbike','機車'],
  購物: ['購買','網購','蝦皮','衣服','褲子','鞋子','包包','手機','電腦','耳機','家電','禮物','生日禮'],
  房租: ['房租','租金','押金','管理費'],
  水電: ['水費','電費','瓦斯','天然氣','網路費','電話費','手機費'],
  醫療: ['看醫生','看診','掛號','門診','急診','藥局','牙醫','疫苗'],
  娛樂: ['電影','唱歌','ktv','遊戲','旅遊','健身','按摩','netflix','spotify','訂閱'],
  孝親: ['孝親','給爸','給媽','紅包','壓歲錢'],
  子女教育: ['學費','補習','才藝','教材','課本','文具','家教','課程'],
  日用品: ['衛生紙','洗衣精','牙膏','牙刷','洗髮','沐浴','寵物','飼料'],
  通訊: ['電話費','網路費','月租費','儲值'],
  其他: [],
}

function inferCategory(fullText: string, description: string, available: string[]): string {
  const text = `${fullText} ${description}`.toLowerCase()
  let best = available[0] ?? '其他'; let bestScore = 0
  for (const cat of available) {
    const kws = CATEGORY_KEYWORDS[cat]; if (!kws) continue
    let score = 0
    for (const kw of kws) { if (text.includes(kw.toLowerCase())) score += kw.length }
    if (score > bestScore) { bestScore = score; best = cat }
  }
  return best
}

const FALLBACK_CATEGORIES = ['餐飲','交通','購物','房租','水電','醫療','娛樂','孝親','子女教育','日用品','通訊','其他']

export function parseExpense(text: string, availableCategories: string[] = FALLBACK_CATEGORIES): ParsedExpense {
  const input = text.trim(); const now = new Date()
  const { date, remaining: r1 } = extractDate(input, now)
  const { amount, remaining: r2 } = extractAmount(r1)
  const description = extractDescription(r2, input)
  const category = inferCategory(input, description, availableCategories)
  return { description: description || input, amount, category, date: date ?? fmtDate(now) }
}
