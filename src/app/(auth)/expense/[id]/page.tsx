'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ExpenseForm } from '@/components/expense-form'
import { ExpenseContextStrip } from '@/components/expense-context-strip'
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
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-3">
        <div className="animate-pulse bg-[var(--muted)] rounded-md h-8 w-32" />
        <div className="animate-pulse bg-[var(--muted)] rounded-md h-24" />
        <div className="animate-pulse bg-[var(--muted)] rounded-md h-16" />
        <div className="animate-pulse bg-[var(--muted)] rounded-md h-16" />
      </div>
    )
  }

  if (!expense) {
    return <div className="p-6 text-center text-[var(--muted-foreground)]">找不到此筆支出</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">編輯支出</h1>
      {/* Context strip (Issue #319) — 本月排名 + 同名 + 同類別累計 */}
      <ExpenseContextStrip expense={expense} allExpenses={expenses} />
      <ExpenseForm existingExpense={expense} onSaved={() => router.push('/records')} />
    </div>
  )
}
