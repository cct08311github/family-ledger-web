'use client'

import { useRouter } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'
import { VoiceInput } from '@/components/voice-input'
import { useGroup } from '@/lib/hooks/use-group'
import { useCategories } from '@/lib/hooks/use-categories'
import type { ParsedExpense } from '@/lib/services/local-expense-parser'
import { useRef } from 'react'

export default function NewExpensePage() {
  const router = useRouter()
  const { group } = useGroup()
  const { categories } = useCategories(group?.id)
  const availableCategories = categories.filter((c) => c.isActive).map((c) => c.name)

  // Expose a setter that ExpenseForm can call back to us via ref
  const onVoiceParsedRef = useRef<((result: ParsedExpense) => void) | null>(null)

  function handleVoiceParsed(result: ParsedExpense) {
    onVoiceParsedRef.current?.(result)
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">新增支出</h1>
        <VoiceInput
          availableCategories={availableCategories.length > 0 ? availableCategories : undefined}
          onParsed={handleVoiceParsed}
        />
      </div>
      <ExpenseForm
        onSaved={() => router.push('/records')}
        onVoiceParsedRef={onVoiceParsedRef}
      />
    </div>
  )
}
