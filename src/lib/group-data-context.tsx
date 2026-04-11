'use client'

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import { collection, onSnapshot, orderBy, query, where, limit, DocumentSnapshot } from 'firebase/firestore'
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
  syncError: string | null
  /** True when the initial subscription returned exactly 200 records (may have more) */
  hasMoreExpenses: boolean
  /** The last Firestore DocumentSnapshot from the initial subscription — use as startAfter cursor */
  lastExpenseDoc: DocumentSnapshot | null
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
  syncError: null,
  hasMoreExpenses: false,
  lastExpenseDoc: null,
})

function getSyncErrorMessage(context: string, err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code === 'permission-denied') return `${context}同步失敗：權限不足，請確認帳號已加入群組`
  if (code === 'unauthenticated') return '登入已過期，請重新登入'
  if (code === 'unavailable' || code === 'resource-exhausted') return `${context}暫時無法連線，將自動重試`
  return `${context}同步失敗，請檢查網路連線`
}

function getSyncToastLevel(err: unknown): 'error' | 'warning' {
  const code = (err as { code?: string })?.code
  return (code === 'unavailable' || code === 'resource-exhausted') ? 'warning' : 'error'
}

export function GroupDataProvider({ children }: { children: ReactNode }) {
  const { activeGroup } = useGroupContext()
  const { user } = useAuth()
  const { addToast } = useToast()
  const groupId = activeGroup?.id

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [hasMoreExpenses, setHasMoreExpenses] = useState(false)
  const [lastExpenseDoc, setLastExpenseDoc] = useState<DocumentSnapshot | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [settlementsLoading, setSettlementsLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [notificationsLoading, setNotificationsLoading] = useState(true)

  // Reset all data when group changes
  useEffect(() => {
    setExpenses([])
    setHasMoreExpenses(false)
    setLastExpenseDoc(null)
    setMembers([])
    setSettlements([])
    setCategories([])
    setNotifications([])
    setSyncError(null)
    setExpensesLoading(true)
    setMembersLoading(true)
    setSettlementsLoading(true)
    setCategoriesLoading(true)
    setNotificationsLoading(true)
  }, [groupId])

  // Expenses subscription
  useEffect(() => {
    if (!groupId) { setExpensesLoading(false); return }
    const EXPENSES_LIMIT = 200
    const q = query(collection(db, 'groups', groupId, 'expenses'), orderBy('date', 'desc'), limit(EXPENSES_LIMIT))
    const unsub = onSnapshot(q,
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense))
        setHasMoreExpenses(snap.docs.length === EXPENSES_LIMIT)
        setLastExpenseDoc(snap.docs[snap.docs.length - 1] ?? null)
        setExpensesLoading(false)
        setSyncError(null)
      },
      (err) => { logger.error('[GroupData] expenses error:', err); addToast(getSyncErrorMessage('費用資料', err), getSyncToastLevel(err)); setSyncError(getSyncErrorMessage('費用資料', err)); setExpensesLoading(false) },
    )
    return unsub
  }, [groupId])

  // Members subscription
  useEffect(() => {
    if (!groupId) { setMembersLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'members'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => { setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember)); setMembersLoading(false); setSyncError(null) },
      (err) => { logger.error('[GroupData] members error:', err); addToast(getSyncErrorMessage('成員資料', err), getSyncToastLevel(err)); setSyncError(getSyncErrorMessage('成員資料', err)); setMembersLoading(false) },
    )
    return unsub
  }, [groupId])

  // Settlements subscription
  useEffect(() => {
    if (!groupId) { setSettlementsLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'settlements'), orderBy('date', 'desc'), limit(200))
    const unsub = onSnapshot(q,
      (snap) => { setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement)); setSettlementsLoading(false); setSyncError(null) },
      (err) => { logger.error('[GroupData] settlements error:', err); addToast(getSyncErrorMessage('結算資料', err), getSyncToastLevel(err)); setSyncError(getSyncErrorMessage('結算資料', err)); setSettlementsLoading(false) },
    )
    return unsub
  }, [groupId])

  // Categories subscription
  useEffect(() => {
    if (!groupId) { setCategoriesLoading(false); return }
    const q = query(collection(db, 'groups', groupId, 'categories'), orderBy('sortOrder'))
    const unsub = onSnapshot(q,
      (snap) => { setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)); setCategoriesLoading(false); setSyncError(null) },
      (err) => { logger.error('[GroupData] categories error:', err); addToast(getSyncErrorMessage('分類資料', err), getSyncToastLevel(err)); setSyncError(getSyncErrorMessage('分類資料', err)); setCategoriesLoading(false) },
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
      (snap) => { setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification)); setNotificationsLoading(false); setSyncError(null) },
      (err) => { logger.error('[GroupData] notifications error:', err.message); addToast(getSyncErrorMessage('通知', err), getSyncToastLevel(err)); setSyncError(getSyncErrorMessage('通知', err)); setNotificationsLoading(false) },
    )
    return unsub
  }, [groupId, user])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  const value = useMemo(() => ({
    expenses, members, settlements, categories, notifications, unreadCount,
    expensesLoading, membersLoading, settlementsLoading, categoriesLoading, notificationsLoading,
    syncError, hasMoreExpenses, lastExpenseDoc,
  }), [expenses, members, settlements, categories, notifications, unreadCount,
       expensesLoading, membersLoading, settlementsLoading, categoriesLoading, notificationsLoading,
       syncError, hasMoreExpenses, lastExpenseDoc])

  return (
    <GroupDataContext.Provider value={value}>
      {children}
    </GroupDataContext.Provider>
  )
}

export const useGroupData = () => useContext(GroupDataContext)
