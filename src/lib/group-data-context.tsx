'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import { collection, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useGroupContext } from '@/lib/group-context'
import { useAuth } from '@/lib/auth'
import type { Expense, FamilyMember, Settlement, Category, AppNotification } from '@/lib/types'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/toast'

interface GroupDataContextType {
  expenses: Expense[]
  members: FamilyMember[]
  settlements: Settlement[]
  categories: Category[]
  notifications: AppNotification[]
  unreadCount: number
  expensesLoading: boolean
  membersLoading: boolean
  settlementsLoading: boolean
  categoriesLoading: boolean
  hasError: boolean
}

const GroupDataContext = createContext<GroupDataContextType>({
  expenses: [],
  members: [],
  settlements: [],
  categories: [],
  notifications: [],
  unreadCount: 0,
  expensesLoading: true,
  membersLoading: true,
  settlementsLoading: true,
  categoriesLoading: true,
  hasError: false,
})

export function GroupDataProvider({ children }: { children: ReactNode }) {
  const { activeGroup } = useGroupContext()
  const { user } = useAuth()
  const groupId = activeGroup?.id
  const toast = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [settlementsLoading, setSettlementsLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback((label: string, message: string, err: unknown) => {
    logger.error(label, err)
    setHasError(true)
    toast.error(message)
  }, [toast])

  // Reset all data when group changes
  useEffect(() => {
    setExpenses([])
    setMembers([])
    setSettlements([])
    setCategories([])
    setNotifications([])
    setExpensesLoading(true)
    setMembersLoading(true)
    setSettlementsLoading(true)
    setCategoriesLoading(true)
    setHasError(false)
  }, [groupId])

  // Expenses subscription
  useEffect(() => {
    if (!groupId) { setExpensesLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'), limit(200))
    const unsub = onSnapshot(q,
      (snap) => { setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)); setExpensesLoading(false) },
      (err) => { handleError('[GroupData] expenses error:', '支出資料同步失敗，請檢查網路連線', err); setExpensesLoading(false) },
    )
    return unsub
  }, [groupId, handleError])

  // Members subscription
  useEffect(() => {
    if (!groupId) { setMembersLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => { setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember)); setMembersLoading(false) },
      (err) => { handleError('[GroupData] members error:', '成員資料同步失敗，請檢查網路連線', err); setMembersLoading(false) },
    )
    return unsub
  }, [groupId, handleError])

  // Settlements subscription
  useEffect(() => {
    if (!groupId) { setSettlementsLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'settlements'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => { setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement)); setSettlementsLoading(false) },
      (err) => { handleError('[GroupData] settlements error:', '結算資料同步失敗，請檢查網路連線', err); setSettlementsLoading(false) },
    )
    return unsub
  }, [groupId, handleError])

  // Categories subscription
  useEffect(() => {
    if (!groupId) { setCategoriesLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'categories'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => { setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)); setCategoriesLoading(false) },
      (err) => { handleError('[GroupData] categories error:', '分類資料同步失敗，請檢查網路連線', err); setCategoriesLoading(false) },
    )
    return unsub
  }, [groupId, handleError])

  // Notifications subscription (per-user, with limit)
  useEffect(() => {
    if (!groupId || !user) { setNotifications([]); return }
    const q = query(
      collection(db, 'groups', groupId, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(q,
      (snap) => { setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification)) },
      (err) => { handleError('[GroupData] notifications error:', '通知資料同步失敗，請檢查網路連線', err) },
    )
    return unsub
  }, [groupId, user, handleError])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  const value = useMemo(() => ({
    expenses, members, settlements, categories, notifications, unreadCount,
    expensesLoading, membersLoading, settlementsLoading, categoriesLoading, hasError,
  }), [expenses, members, settlements, categories, notifications, unreadCount,
       expensesLoading, membersLoading, settlementsLoading, categoriesLoading, hasError])

  return (
    <GroupDataContext.Provider value={value}>
      {children}
    </GroupDataContext.Provider>
  )
}

export const useGroupData = () => useContext(GroupDataContext)
