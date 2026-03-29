import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/parse-expense
 * Server-side Gemini 2.0 Flash call to parse natural language expense input.
 * Expects: { text: string; apiKey: string; categories?: string[] }
 * Returns: { description, amount, category, date } | { error }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.text !== 'string' || typeof body.apiKey !== 'string') {
    return NextResponse.json({ error: 'Missing text or apiKey' }, { status: 400 })
  }

  const { text, apiKey, categories } = body as {
    text: string
    apiKey: string
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
    const errText = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Gemini API error ${res.status}: ${errText.slice(0, 200)}` },
      { status: 502 },
    )
  }

  const data = await res.json()
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(rawText)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Failed to parse Gemini response', raw: rawText }, { status: 502 })
  }
}
