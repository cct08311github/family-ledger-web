'use client'

import { useRouter } from 'next/navigation'
import { ExpenseForm } from '@/components/expense-form'

export default function NewExpensePage() {
  const router = useRouter()
  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">新增支出</h1>
      <ExpenseForm onSaved={() => router.push('/records')} />
    </div>
  )
}
