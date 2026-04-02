'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ExpenseForm } from '@/components/expense-form'
import type { Expense } from '@/lib/types'

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('groupId')
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    getDoc(doc(db, 'groups', groupId, 'expenses', id)).then((snap) => {
      if (snap.exists()) {
        setExpense({ id: snap.id, ...snap.data() } as Expense)
      }
      setLoading(false)
    })
  }, [id, groupId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!expense) {
    return <div className="p-6 text-center text-[var(--muted-foreground)]">找不到此筆支出</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">編輯支出</h1>
      <ExpenseForm existingExpense={expense} onSaved={() => router.push('/records')} />
    </div>
  )
}
