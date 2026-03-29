'use client'

import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading, router])

  const handleSignIn = async () => {
    setSigning(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登入失敗')
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-8">
        <div className="space-y-2">
          <div className="text-6xl">💰</div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>家計本</h1>
          <p className="text-[var(--muted-foreground)]">
            全家人共享記帳．自動拆帳．一目了然誰欠誰
          </p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={signing}
          className="w-full h-12 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-medium flex items-center justify-center gap-2 hover:bg-[var(--muted)] transition disabled:opacity-50"
        >
          {signing ? (
            <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <>
              <span className="text-lg font-bold">G</span>
              使用 Google 帳號登入
            </>
          )}
        </button>

        {error && (
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>
        )}

        <p className="text-xs text-[var(--muted-foreground)]">
          登入後可在多台裝置間同步資料
        </p>
      </div>
    </div>
  )
}
