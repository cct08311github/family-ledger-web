'use client'

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
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
  notificationsLoading: boolean
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
  notificationsLoading: true,
})

export function GroupDataProvider({ children }: { children: ReactNode }) {
  const { activeGroup } = useGroupContext()
  const { user } = useAuth()
  const { addToast } = useToast()
  const groupId = activeGroup?.id

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [settlementsLoading, setSettlementsLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [notificationsLoading, setNotificationsLoading] = useState(true)

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
    setNotificationsLoading(true)
  }, [groupId])

  // Expenses subscription
  useEffect(() => {
    if (!groupId) { setExpensesLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'), limit(200))
    const unsub = onSnapshot(q,
      (snap) => { setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)); setExpensesLoading(false) },
      (err) => { logger.error('[GroupData] expenses error:', err); addToast('資料同步失敗，請檢查網路連線', 'error'); setExpensesLoading(false) },
    )
    return unsub
  }, [groupId])

  // Members subscription
  useEffect(() => {
    if (!groupId) { setMembersLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => { setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember)); setMembersLoading(false) },
      (err) => { logger.error('[GroupData] members error:', err); addToast('資料同步失敗，請檢查網路連線', 'error'); setMembersLoading(false) },
    )
    return unsub
  }, [groupId])

  // Settlements subscription
  useEffect(() => {
    if (!groupId) { setSettlementsLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'settlements'), orderBy('date', 'desc'), limit(200))
    const unsub = onSnapshot(q,
      (snap) => { setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement)); setSettlementsLoading(false) },
      (err) => { logger.error('[GroupData] settlements error:', err); addToast('資料同步失敗，請檢查網路連線', 'error'); setSettlementsLoading(false) },
    )
    return unsub
  }, [groupId])

  // Categories subscription
  useEffect(() => {
    if (!groupId) { setCategoriesLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'categories'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => { setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)); setCategoriesLoading(false) },
      (err) => { logger.error('[GroupData] categories error:', err); addToast('資料同步失敗，請檢查網路連線', 'error'); setCategoriesLoading(false) },
    )
    return unsub
  }, [groupId])

  // Notifications subscription (per-user, with limit)
  useEffect(() => {
    if (!groupId || !user) { setNotifications([]); setNotificationsLoading(false); return }
    const q = query(
      collection(db, 'groups', groupId, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(q,
      (snap) => { setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification)); setNotificationsLoading(false) },
      (err) => { logger.error('[GroupData] notifications error:', err.message); addToast('資料同步失敗，請檢查網路連線', 'error'); setNotificationsLoading(false) },
    )
    return unsub
  }, [groupId, user])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  const value = useMemo(() => ({
    expenses, members, settlements, categories, notifications, unreadCount,
    expensesLoading, membersLoading, settlementsLoading, categoriesLoading, notificationsLoading,
  }), [expenses, members, settlements, categories, notifications, unreadCount,
       expensesLoading, membersLoading, settlementsLoading, categoriesLoading, notificationsLoading])

  return (
    <GroupDataContext.Provider value={value}>
      {children}
    </GroupDataContext.Provider>
  )
}

export const useGroupData = () => useContext(GroupDataContext)
