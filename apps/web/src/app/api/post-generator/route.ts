import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはパーソナルジムオーナー向けのSNS投稿を作成する専門家です。
ターゲットは独立3年以内の売上に悩むジムオーナーです。
投稿は共感・痛みを突く・解決策を示す構成で作成してください。
Threadsは300文字以内、Xは140文字以内で作成してください。`

const ALLOWED_THEMES = ['集客tips', 'お客様の声', 'ビフォーアフター', 'モチベーション'] as const
const ALLOWED_PLATFORMS = ['Threads', 'X'] as const
const ALLOWED_TONES = ['共感系', '挑発系', '教育系'] as const

type PostGeneratorRequest = {
  theme?: string
  platform?: string
  tone?: string
}

function isAllowed<T extends readonly string[]>(value: string | undefined, list: T): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません。' },
      { status: 500 },
    )
  }

  let body: PostGeneratorRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です。' }, { status: 400 })
  }

  const { theme, platform, tone } = body

  if (
    !isAllowed(theme, ALLOWED_THEMES) ||
    !isAllowed(platform, ALLOWED_PLATFORMS) ||
    !isAllowed(tone, ALLOWED_TONES)
  ) {
    return NextResponse.json({ error: '選択内容が不正です。' }, { status: 400 })
  }

  const userPrompt = `以下の条件で、SNS投稿文を1本だけ作成してください。

投稿テーマ: ${theme}
プラットフォーム: ${platform}
トーン: ${tone}

条件:
- 出力は投稿本文のみ
- 余計な前置き、見出し、注釈、引用符は不要
- 読み手は独立3年以内の売上に悩むパーソナルジムオーナー
- 冒頭で共感または痛みを明確に示し、その後に実践的な解決策を提示する`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Claude API の呼び出しに失敗しました: ${errorText}` },
        { status: 502 },
      )
    }

    const data = await response.json() as {
      content?: Array<{ type?: string; text?: string }>
    }
    const text = data.content
      ?.filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join('\n\n')

    if (!text) {
      return NextResponse.json({ error: '投稿文を取得できませんでした。' }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json(
      { error: '投稿文の生成中にエラーが発生しました。' },
      { status: 500 },
    )
  }
}
