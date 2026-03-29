import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/parse-expense
 * Server-side Gemini 2.0 Flash call to parse natural language expense input.
 * Expects: { text: string; apiKey: string; categories?: string[] }
 * Returns: { description, amount, category, date } | { error }
 */
export async function POST(req: NextRequest) {
  // API key is transmitted via header (not body) to avoid logging in request payloads
  const apiKey = req.headers.get('x-gemini-key')
  const body = await req.json().catch(() => null)
  if (!body || typeof body.text !== 'string' || !apiKey) {
    return NextResponse.json({ error: 'Missing text or x-gemini-key header' }, { status: 400 })
  }

  const { text, categories } = body as {
    text: string
    categories?: string[]
  }

  const catList = Array.isArray(categories) && categories.length > 0
    ? categories
    : ['餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他']

  const today = new Date().toISOString().split('T')[0]

  const prompt = `你是一個記帳助手，請從以下語音轉錄文字中提取支出資訊。

今天日期：${today}
可用類別：${catList.join('、')}

語音輸入：「${text}」

請以 JSON 格式回傳，不含其他文字：
{
  "description": "支出描述（簡潔名詞，去掉動詞和助詞）",
  "amount": 數字金額（整數或小數，無法確定則回傳 0）,
  "category": "從可用類別中選一個最符合的",
  "date": "YYYY-MM-DD 格式，若有相對日期（昨天/前天）請轉換，否則用今天"
}`

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    },
  )

  if (!res.ok) {
    // Log full error server-side only; return generic message to client
    const errText = await res.text().catch(() => '')
    console.error(`[parse-expense] Gemini API error ${res.status}: ${errText}`)
    return NextResponse.json({ error: `AI 解析服務暫時無法使用（${res.status}）` }, { status: 502 })
  }

  const data = await res.json()
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>

    // Validate and sanitize all fields before returning to client
    const description = typeof parsed.description === 'string'
      ? parsed.description.slice(0, 200)
      : ''
    const amount = typeof parsed.amount === 'number' && isFinite(parsed.amount) && parsed.amount >= 0
      ? Math.round(parsed.amount)
      : 0
    const category = typeof parsed.category === 'string' && catList.includes(parsed.category)
      ? parsed.category
      : catList[0]
    const dateStr = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : today

    return NextResponse.json({ description, amount, category, date: dateStr })
  } catch {
    console.error('[parse-expense] Failed to parse Gemini response:', rawText)
    return NextResponse.json({ error: 'AI 解析結果格式錯誤' }, { status: 502 })
  }
}
