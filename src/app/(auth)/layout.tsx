'use client'

import { useAuth } from '@/lib/auth'
import { GroupProvider } from '@/lib/group-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { NavShell } from '@/components/nav-shell'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return null

  return (
    <GroupProvider>
      <NavShell>{children}</NavShell>
    </GroupProvider>
  )
}
