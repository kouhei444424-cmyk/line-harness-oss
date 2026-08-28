'use client'

import { useState } from 'react'
import Header from '@/components/layout/header'

const themes = ['集客tips', 'お客様の声', 'ビフォーアフター', 'モチベーション'] as const
const platforms = ['Threads', 'X'] as const
const tones = ['共感系', '挑発系', '教育系'] as const

export default function PostGeneratorPage() {
  const [theme, setTheme] = useState<(typeof themes)[number]>('集客tips')
  const [platform, setPlatform] = useState<(typeof platforms)[number]>('Threads')
  const [tone, setTone] = useState<(typeof tones)[number]>('共感系')
  const [generatedPost, setGeneratedPost] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const characterLimit = platform === 'Threads' ? 300 : 140

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setCopied(false)

    try {
      const response = await fetch('/api/post-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme, platform, tone }),
      })

      const data = await response.json() as { text?: string; error?: string }
      if (!response.ok || !data.text) {
        throw new Error(data.error || '投稿文の生成に失敗しました。')
      }

      setGeneratedPost(data.text)
    } catch (err) {
      setGeneratedPost('')
      setError(err instanceof Error ? err.message : '投稿文の生成に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedPost) return
    try {
      await navigator.clipboard.writeText(generatedPost)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました。')
    }
  }

  return (
    <div>
      <Header
        title="投稿生成"
        description="テーマ・媒体・トーンを選ぶと、SNS投稿文を自動生成します。"
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="space-y-5">
            <SelectField
              label="投稿テーマ"
              value={theme}
              options={themes}
              onChange={(value) => setTheme(value as (typeof themes)[number])}
            />
            <SelectField
              label="プラットフォーム"
              value={platform}
              options={platforms}
              onChange={(value) => setPlatform(value as (typeof platforms)[number])}
            />
            <SelectField
              label="トーン"
              value={tone}
              options={tones}
              onChange={(value) => setTone(value as (typeof tones)[number])}
            />

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: '#06C755' }}
            >
              {loading ? '生成中...' : '生成する'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-h-[420px]">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">生成結果</h2>
              <p className="mt-1 text-sm text-gray-500">
                {generatedPost ? `${generatedPost.length} / ${characterLimit} 文字` : `${characterLimit}文字以内`}
              </p>
            </div>
            <button
              onClick={handleCopy}
              disabled={!generatedPost}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
            >
              {copied ? 'コピー済み' : 'コピー'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4">
            {generatedPost ? (
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
                  {generatedPost}
                </p>
              </div>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
                <p className="text-sm leading-6 text-gray-500">
                  左側で条件を選択して「生成する」を押すと、ここに投稿文が表示されます。
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
