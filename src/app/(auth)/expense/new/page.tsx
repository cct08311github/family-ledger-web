'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import { VoiceInput } from '@/components/voice-input'
import { useCategories } from '@/lib/hooks/use-categories'
import { useExpenses } from '@/lib/hooks/use-expenses'
import type { ParsedExpense } from '@/lib/services/local-expense-parser'
import { useRef } from 'react'

export default function NewExpensePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { categories } = useCategories()
  const { expenses } = useExpenses()
  const availableCategories = categories.filter((c) => c.isActive).map((c) => c.name)

  const duplicateId = searchParams.get('duplicate')
  const duplicateSource = duplicateId ? expenses.find((e) => e.id === duplicateId) : undefined
  // Initial date from ?date=YYYY-MM-DD param (catch-up nudge, Issue #288).
  const initialDate = searchParams.get('date') ?? undefined

  // Expose a setter that ExpenseForm can call back to us via ref
  const onVoiceParsedRef = useRef<((_result: ParsedExpense) => void) | null>(null)

  function handleVoiceParsed(result: ParsedExpense) {
    onVoiceParsedRef.current?.(result)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">新增支出</h1>
        <VoiceInput
          availableCategories={availableCategories.length > 0 ? availableCategories : undefined}
          onParsed={handleVoiceParsed}
        />
      </div>
      <ExpenseForm
        duplicateFrom={duplicateSource}
        initialDate={initialDate}
        onSaved={() => router.push('/records')}
        onVoiceParsedRef={onVoiceParsedRef}
      />
    </div>
  )
}
