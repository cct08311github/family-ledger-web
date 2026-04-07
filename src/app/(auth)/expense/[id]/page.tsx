'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ExpenseForm } from '@/components/expense-form'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { logger } from '@/lib/logger'
import type { Expense } from '@/lib/types'

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('groupId')

  // Prefer the expense already in context to avoid an extra Firestore read
  const { expenses, loading: expensesLoading } = useExpenses()
  const contextExpense = expenses.find((e) => e.id === id)

  const [fetchedExpense, setFetchedExpense] = useState<Expense | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)

  // Fall back to a direct getDoc only when the expense is not in context
  // (e.g. deep-link before GroupDataProvider has finished syncing)
  useEffect(() => {
    if (contextExpense || expensesLoading) return
    if (!groupId) return
    setFetchLoading(true)
    getDoc(doc(db, 'groups', groupId, 'expenses', id))
      .then((snap) => {
        if (snap.exists()) {
          setFetchedExpense({ id: snap.id, ...snap.data() } as Expense)
        }
      })
      .catch((err) => {
        logger.error('[EditExpense] Failed to load expense:', err)
      })
      .finally(() => {
        setFetchLoading(false)
      })
  }, [id, groupId, contextExpense, expensesLoading])

  const loading = expensesLoading || fetchLoading
  const expense = contextExpense ?? fetchedExpense

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
