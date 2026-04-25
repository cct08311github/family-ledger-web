'use client'

import { useState, useEffect, useMemo, type RefObject } from 'react'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useCategories } from '@/lib/hooks/use-categories'
import { addExpense, updateExpense, genExpenseId, type ExpenseInput } from '@/lib/services/expense-service'
import {
  uploadReceiptImages,
  deleteReceiptImages,
  normalizeReceiptPaths,
  MAX_RECEIPTS_PER_EXPENSE,
  ReceiptUploadError,
} from '@/lib/services/image-upload'
import { buildEqualSplits } from '@/lib/services/split-calculator'
import { addRecurringExpense } from '@/lib/services/recurring-expense-service'
import { learnFromExpense, suggestCategory, isAuthError } from '@/lib/services/transaction-rules-service'
import { useAuth, getActor } from '@/lib/auth'
import { toDate } from '@/lib/utils'
import { saveButtonLabel, type UploadProgress } from '@/lib/save-button-label'
import { findPossibleDuplicate } from '@/lib/duplicate-expense-detector'
import { detectAmountOutlier } from '@/lib/amount-outlier'
import { evaluateAmountExpression } from '@/lib/amount-expression'
import { AmountChips } from '@/components/amount-chips'
import { hapticFeedback } from '@/lib/haptic'
import { findLastExpenseByCategory, relativeDays } from '@/lib/last-category-expense'
import { currency as fmtCurrency } from '@/lib/utils'
import { useSubmitGuard } from '@/lib/hooks/use-submit-guard'
import { ref as storageRef, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import { ReceiptGallery } from '@/components/receipt-gallery'
import type { Expense, SplitMethod, PaymentMethod, SplitDetail } from '@/lib/types'
import type { ParsedExpense } from '@/lib/services/local-expense-parser'

const FALLBACK_CATEGORIES = ['餐飲', '交通', '購物', '房租', '水電', '醫療', '娛樂', '孝親', '子女教育', '日用品', '通訊', '其他']

interface Props {
  existingExpense?: Expense
  duplicateFrom?: Expense
  onSaved: () => void
  /** Ref to register a setter for voice-parsed results. Parent passes ref, form fills it on mount. */
  onVoiceParsedRef?: RefObject<((_result: ParsedExpense) => void) | null>
}


export function ExpenseForm({ existingExpense, duplicateFrom, onSaved, onVoiceParsedRef }: Props) {
  const { group } = useGroup()
  const { members } = useMembers()
  const { expenses } = useExpenses()
  const { categories: firestoreCategories } = useCategories()
  const categoryList = firestoreCategories.length > 0
    ? firestoreCategories.filter((c) => c.isActive).map((c) => c.name)
    : FALLBACK_CATEGORIES

  // Build hierarchy: top-level + their children for grouped <select>
  const categoryGroups = (() => {
    if (firestoreCategories.length === 0) {
      return [{ parent: null as string | null, children: FALLBACK_CATEGORIES }]
    }
    const active = firestoreCategories.filter((c) => c.isActive)
    const top = active.filter((c) => !c.parentCategoryName)
    const childMap = new Map<string, string[]>()
    for (const c of active) {
      if (c.parentCategoryName) {
        const arr = childMap.get(c.parentCategoryName) ?? []
        arr.push(c.name)
        childMap.set(c.parentCategoryName, arr)
      }
    }
    return top.map((p) => ({
      parent: p.name,
      children: childMap.get(p.name) ?? [],
    }))
  })()
  const { user } = useAuth()
  const isEditing = !!existingExpense

  const source = existingExpense ?? duplicateFrom

  const [date, setDate] = useState(() => {
    if (source && !duplicateFrom) return toDate(source.date).toISOString().split('T')[0]
    return new Date().toISOString().split('T')[0]
  })
  const [description, setDescription] = useState(source?.description ?? '')
  const [amount, setAmount] = useState(source?.amount?.toString() ?? '')
  const [category, setCategory] = useState(source?.category ?? '餐飲')
  const [isShared, setIsShared] = useState(source?.isShared ?? true)
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(source?.splitMethod ?? 'equal')
  const [payerId, setPayerId] = useState(source?.payerId ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(source?.paymentMethod ?? 'cash')
  const [note, setNote] = useState(source?.note ?? '')
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set())
  const [percentages, setPercentages] = useState<Record<string, number>>({})
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({})
  const [weights, setWeights] = useState<Record<string, number>>({})
  const { inFlight: saving, run: runSubmit } = useSubmitGuard()
  /** Upload progress for receipt images: both 0 when idle. */
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [autoCategoryFilled, setAutoCategoryFilled] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [setAsRecurring, setSetAsRecurring] = useState(false)
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState(() => new Date().getDate())

  // 收據圖片：既有路徑 + 本機待上傳 File
  const [existingReceiptPaths, setExistingReceiptPaths] = useState<string[]>(() =>
    source ? normalizeReceiptPaths(source) : [],
  )
  const [existingReceiptUrls, setExistingReceiptUrls] = useState<Record<string, string>>({})
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [removedPaths, setRemovedPaths] = useState<string[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)

  // Load download URLs for existing receipt paths. We intentionally omit
  // `existingReceiptUrls` from deps — the functional setState below reads the
  // current map, and including it would retrigger the effect after every URL
  // load without adding value.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      existingReceiptPaths.map(async (p) => {
        try {
          const downloadUrl = await getDownloadURL(storageRef(storage, p))
          // Route through same-origin proxy (/api/receipt) — direct
          // firebasestorage.googleapis.com URLs don't render reliably in iOS PWA.
          const u = new URL(downloadUrl)
          const token = u.searchParams.get('token')
          if (!token) return [p, downloadUrl] as const
          const proxyUrl = `/family-ledger-web/api/receipt?path=${encodeURIComponent(p)}&token=${encodeURIComponent(token)}`
          return [p, proxyUrl] as const
        } catch {
          return [p, ''] as const
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      setExistingReceiptUrls((prev) => {
        const next = { ...prev }
        for (const [p, url] of entries) {
          if (url && !next[p]) next[p] = url
        }
        return next
      })
    })
    return () => { cancelled = true }
  }, [existingReceiptPaths])

  // Local object URLs for new file previews (cleanup on change)
  const newFilePreviews = useMemo(() => newFiles.map((f) => URL.createObjectURL(f)), [newFiles])
  useEffect(() => {
    return () => { newFilePreviews.forEach((u) => URL.revokeObjectURL(u)) }
  }, [newFilePreviews])

  const totalImageCount = existingReceiptPaths.length + newFiles.length
  const canAddMore = totalImageCount < MAX_RECEIPTS_PER_EXPENSE

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    const images = picked.filter((f) => f.type.startsWith('image/'))
    if (images.length < picked.length) {
      setError('只能上傳圖片檔案')
    }
    const room = MAX_RECEIPTS_PER_EXPENSE - totalImageCount
    if (room <= 0) {
      setError(`最多只能上傳 ${MAX_RECEIPTS_PER_EXPENSE} 張圖片`)
      return
    }
    const accepted = images.slice(0, room)
    if (images.length > room) {
      setError(`最多只能上傳 ${MAX_RECEIPTS_PER_EXPENSE} 張，已略過 ${images.length - room} 張`)
    }
    setNewFiles((prev) => [...prev, ...accepted])
  }

  function removeNewFile(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function removeExistingPath(path: string) {
    setExistingReceiptPaths((prev) => prev.filter((p) => p !== path))
    setRemovedPaths((prev) => [...prev, path])
  }

  // 語音解析回填：父元件透過 ref 呼叫此函數填入欄位
  useEffect(() => {
    if (!onVoiceParsedRef) return
    onVoiceParsedRef.current = (result: ParsedExpense) => {
      if (result.description) setDescription(result.description)
      if (result.amount > 0) setAmount(String(result.amount))
      if (result.date) setDate(result.date)
      if (result.category && categoryList.includes(result.category)) setCategory(result.category)
    }
    return () => { onVoiceParsedRef.current = null }
  }, [onVoiceParsedRef, categoryList])

  // 最近描述（自動完成）
  const recentDescs = [...new Set(expenses.map((e) => e.description))].slice(0, 20)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const filteredDescs = description
    ? recentDescs.filter((d) => d.toLowerCase().includes(description.toLowerCase())).slice(0, 5)
    : recentDescs.slice(0, 5)

  // 草稿 key（per group + user，僅用於新增模式）
  const draftKey = !isEditing && group?.id && user?.uid
    ? `expense-draft-${group.id}-${user.uid}`
    : null
  const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

  // 偵測既有草稿（mount-only）
  useEffect(() => {
    if (!draftKey || isEditing) return
    if (typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return
      const data = JSON.parse(raw) as { savedAt: number; description?: string }
      if (Date.now() - data.savedAt > DRAFT_MAX_AGE_MS) {
        sessionStorage.removeItem(draftKey)
        return
      }
      // Only show banner if there's something meaningful in the draft
      if (data.description && data.description.trim()) {
        setHasDraft(true)
      }
    } catch {
      sessionStorage.removeItem(draftKey)
    }
  }, [draftKey, isEditing])

  // 自動儲存草稿（debounced）
  useEffect(() => {
    if (!draftKey || isEditing) return
    if (typeof window === 'undefined') return
    // Don't auto-save until user has typed something
    if (!description.trim() && !amount) return
    const handle = setTimeout(() => {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            savedAt: Date.now(),
            description,
            amount,
            category,
            paymentMethod,
            isShared,
            splitMethod,
            note,
          }),
        )
      } catch { /* quota exceeded — silent */ }
    }, 500)
    return () => clearTimeout(handle)
  }, [draftKey, isEditing, description, amount, category, paymentMethod, isShared, splitMethod, note])

  function restoreDraft() {
    if (!draftKey) return
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return
      const data = JSON.parse(raw) as {
        description?: string
        amount?: string
        category?: string
        paymentMethod?: PaymentMethod
        isShared?: boolean
        splitMethod?: SplitMethod
        note?: string
      }
      if (data.description) setDescription(data.description)
      if (data.amount) setAmount(data.amount)
      if (data.category) setCategory(data.category)
      if (data.paymentMethod) setPaymentMethod(data.paymentMethod)
      if (typeof data.isShared === 'boolean') setIsShared(data.isShared)
      if (data.splitMethod) setSplitMethod(data.splitMethod)
      if (data.note) setNote(data.note)
      setDraftRestored(true)
      setHasDraft(false)
    } catch { /* silent */ }
  }

  function dismissDraft() {
    if (!draftKey) return
    sessionStorage.removeItem(draftKey)
    setHasDraft(false)
  }

  // 智能分類建議：描述變更時查詢學習到的規則（僅新增模式，不影響編輯）
  useEffect(() => {
    if (isEditing || !group?.id || description.trim().length < 2) {
      setAutoCategoryFilled(false)
      return
    }
    let cancelled = false
    const trimmed = description.trim()
    const handle = setTimeout(() => {
      suggestCategory(group.id, trimmed)
        .then((suggested) => {
          if (cancelled) return
          if (suggested && categoryList.includes(suggested)) {
            setCategory(suggested)
            setAutoCategoryFilled(true)
          }
        })
        .catch((e) => {
          // Auth errors surface to system_logs so ops can see session/membership
          // issues; the main expense save path will also fail visibly in that
          // state, so no inline toast needed here. Non-auth errors stay silent
          // (best-effort suggestion). Issue #164.
          if (isAuthError(e)) {
            logger.error('[ExpenseForm] suggestCategory auth error', e)
          }
        })
    }, 300)
    return () => { clearTimeout(handle); cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, group?.id, isEditing])

  // 初始化參與者和付款人
  useEffect(() => {
    if (members.length === 0) return
    // Set payerId if empty OR if current payerId is no longer valid (member was removed)
    const payerValid = members.some((m) => m.id === payerId)
    if (!payerId || !payerValid) setPayerId(members[0].id)
    if (participantIds.size === 0) {
      if (source?.splits) {
        setParticipantIds(new Set(source.splits.filter((s) => s.isParticipant).map((s) => s.memberId)))
        if (source.splitMethod === 'percentage') {
          const total = source.amount
          const pcts: Record<string, number> = {}
          for (const s of source.splits.filter((s) => s.isParticipant)) {
            pcts[s.memberId] = total > 0 ? Math.round(s.shareAmount / total * 100) : 0
          }
          setPercentages(pcts)
        }
        if (source.splitMethod === 'custom') {
          const customs: Record<string, number> = {}
          for (const s of source.splits.filter((s) => s.isParticipant)) {
            customs[s.memberId] = s.shareAmount
          }
          setCustomAmounts(customs)
        }
        if (source.splitMethod === 'weight') {
          // Can't recover exact original weights from share amounts; derive proportional integers
          const participantSplits = source.splits.filter((s) => s.isParticipant)
          const minShare = Math.min(...participantSplits.map((s) => s.shareAmount).filter((a) => a > 0))
          const ws: Record<string, number> = {}
          for (const s of participantSplits) {
            ws[s.memberId] = minShare > 0 ? Math.max(1, Math.round(s.shareAmount / minShare)) : 1
          }
          setWeights(ws)
        }
      } else {
        setParticipantIds(new Set(members.map((m) => m.id)))
      }
    }
  }, [members, source, payerId, participantIds.size])

  // Warn when a family member appears to have recorded the same bill in the
  // last 5 minutes. Skip when user explicitly dismissed this candidate.
  // Issue #211.
  const [dismissedDuplicateKey, setDismissedDuplicateKey] = useState<string | null>(null)
  // Amount outlier dismiss key (Issue #284). Same per-candidate dismiss pattern.
  const [dismissedOutlierKey, setDismissedOutlierKey] = useState<string | null>(null)
  // 1-min tick so the banner self-clears once the 5-min window expires
  // without requiring any field change (reviewer flagged that Date.now()
  // inside useMemo was a hidden dep).
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const possibleDuplicate = useMemo(() => {
    if (!description.trim() || !amount) return null
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) return null
    return findPossibleDuplicate(
      {
        description,
        amount: amt,
        // Exclude both edit-target and duplicate-source so the banner doesn't
        // point at "this very record" in either flow.
        isEditingId: existingExpense?.id ?? duplicateFrom?.id,
        // Enable self-duplicate detection (Issue #227). When the same user
        // just recorded the same description+amount, warn — 60 min window.
        selfUserId: user?.uid,
      },
      expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        payerName: e.payerName,
        createdAt: e.createdAt,
        createdBy: e.createdBy,
      })),
      nowTick,
    )
  }, [description, amount, expenses, existingExpense?.id, duplicateFrom?.id, nowTick, user?.uid])
  // Key includes amount + trimmed description so a dismiss only sticks for
  // the exact (id, amount, desc) combo — editing description reveals a fresh
  // banner rather than silently staying dismissed.
  const duplicateKey = possibleDuplicate
    ? `${possibleDuplicate.id}-${possibleDuplicate.amount}-${description.trim().toLowerCase()}`
    : null
  const showDuplicateWarning = !!possibleDuplicate && duplicateKey !== dismissedDuplicateKey

  // Amount outlier check (Issue #284): uses parsed expression value + selected
  // category against last ~90 days of same-category history.
  const outlierResult = useMemo(() => {
    if (!category) return null
    const parsed = evaluateAmountExpression(amount)
    if (!parsed.ok || parsed.value <= 0) return null
    return detectAmountOutlier({
      amount: parsed.value,
      category,
      expenses,
      excludeId: existingExpense?.id,
    })
  }, [amount, category, expenses, existingExpense?.id])
  const outlierKey = outlierResult?.isOutlier
    ? `${category}-${outlierResult.kind}-${amount}`
    : null
  const showOutlierWarning =
    !!outlierResult?.isOutlier && outlierKey !== dismissedOutlierKey

  const buildSplits = (): SplitDetail[] => {
    const amt = parseFloat(amount) || 0
    const participants = members.filter((m) => participantIds.has(m.id))
    if (participants.length === 0) return []
    const nameMap = Object.fromEntries(members.map((m) => [m.id, m.name]))

    if (splitMethod === 'equal') {
      return buildEqualSplits(amt, participants, payerId)
    }

    return participants.map((m, i) => {
      let share: number
      if (splitMethod === 'percentage') {
        share = Math.round(amt * (percentages[m.id] ?? 0) / 100)
        // Distribute rounding remainder to last participant to ensure sum matches amount
        if (i === participants.length - 1) {
          const total = participants.reduce((s, pm) => s + Math.round(amt * (percentages[pm.id] ?? 0) / 100), 0)
          share += amt - total
        }
      } else if (splitMethod === 'weight') {
        const totalWeight = participants.reduce((s, pm) => s + (weights[pm.id] ?? 1), 0)
        const myWeight = weights[m.id] ?? 1
        share = totalWeight > 0 ? Math.round((amt * myWeight) / totalWeight) : 0
        // Distribute rounding remainder to last participant
        if (i === participants.length - 1) {
          const total = participants.reduce((s, pm) => {
            const w = weights[pm.id] ?? 1
            return s + Math.round((amt * w) / (totalWeight || 1))
          }, 0)
          share += amt - total
        }
      } else {
        share = customAmounts[m.id] ?? 0
      }
      return {
        memberId: m.id,
        memberName: nameMap[m.id] ?? '',
        shareAmount: share,
        paidAmount: m.id === payerId ? amt : 0,
        isParticipant: true,
      }
    })
  }

  const handleSave = async () => {
    if (!group?.id || !description.trim() || !amount || !payerId) {
      setError('請填寫必要欄位')
      return
    }
    const parsedAmount = evaluateAmountExpression(amount)
    if (!parsedAmount.ok || parsedAmount.value <= 0) {
      setError('金額無效或必須大於 0')
      return
    }
    const saveAmt = parsedAmount.value
    // Sync the field with the canonical number so the user sees what will be saved
    if (String(saveAmt) !== amount.trim()) setAmount(String(saveAmt))
    const splits = isShared ? buildSplits() : []
    if (isShared && splitMethod !== 'equal') {
      const splitSum = splits.reduce((s, sp) => s + sp.shareAmount, 0)
      if (splitSum !== saveAmt) {
        setError(`分帳金額合計 (NT$ ${splitSum}) 與支出金額 (NT$ ${saveAmt}) 不符`)
        return
      }
    }
    setError(null)
    // Guard acquired here, inside runSubmit. All earlier validation (buildSplits,
    // parseFloat, sum check) is synchronous, so tryAcquire() runs before this
    // async handler yields to the event loop — second clicks are blocked.
    // If future changes insert any await between the click entry and this
    // runSubmit call, move the guard earlier.
    await runSubmit(async () => {
      try {
        const expenseId = isEditing ? existingExpense!.id : genExpenseId()
        const uploaderUid = user?.uid ?? payerId

        // Upload any newly picked images first. On partial failure, uploadReceiptImages
        // rolls back everything it uploaded in this call so we never leave orphans.
        // Progress callback drives the "上傳中 N/M 張" indicator on the submit button.
        let uploadedPaths: string[] = []
        if (newFiles.length > 0) {
          setUploadProgress({ current: 0, total: newFiles.length })
          const result = await uploadReceiptImages(
            group.id,
            expenseId,
            newFiles,
            uploaderUid,
            (current, total) => setUploadProgress({ current, total }),
          )
          uploadedPaths = result.paths
        }

        const finalPaths = [...existingReceiptPaths, ...uploadedPaths]

        const input: ExpenseInput = {
          date: new Date(`${date}T00:00:00`),
          description: description.trim(),
          amount: saveAmt,
          category,
          isShared,
          splitMethod,
          payerId,
          payerName: members.find((m) => m.id === payerId)?.name ?? '',
          splits,
          paymentMethod,
          receiptPaths: finalPaths,
          note: note.trim() || undefined,
          createdBy: uploaderUid,
        }
        try {
          if (isEditing) {
            await updateExpense(group.id, existingExpense!.id, input, getActor(user))
          } else {
            await addExpense(group.id, input, getActor(user), expenseId)
          }
        } catch (writeErr) {
          // Firestore write failed — rollback freshly uploaded files so they don't orphan.
          // If the rollback itself fails we must surface it: the remaining blobs
          // incur storage cost and contain PII, and silently swallowing the error
          // would leave no audit trail. See Issue #150 follow-up about a
          // server-side orphan scanner.
          if (uploadedPaths.length > 0) {
            deleteReceiptImages(uploadedPaths).catch((rollbackErr) => {
              logger.error('[ExpenseForm] Orphan receipts after failed Firestore write', {
                groupId: group.id,
                expenseId,
                paths: uploadedPaths,
                rollbackErr,
              })
            })
          }
          throw writeErr
        }

        // Firestore write succeeded — now safe to delete receipts the user removed.
        if (removedPaths.length > 0) {
          deleteReceiptImages(removedPaths).catch((removeErr) => {
            logger.error('[ExpenseForm] Failed to delete removed receipts', {
              groupId: group.id,
              expenseId,
              paths: removedPaths,
              removeErr,
            })
          })
        }
        // Create recurring template if toggled
        if (setAsRecurring && !isEditing) {
          addRecurringExpense(group.id, {
            description: input.description,
            amount: input.amount,
            category: input.category,
            payerId: input.payerId,
            payerName: input.payerName,
            isShared: input.isShared,
            splitMethod: input.splitMethod,
            splits: input.splits,
            paymentMethod: input.paymentMethod,
            frequency: 'monthly',
            dayOfMonth: recurringDayOfMonth,
            startDate: input.date,
            createdBy: input.createdBy,
          }).catch(() => { /* silent — template creation is non-critical */ })
        }
        // Learn from this save to improve future auto-categorization
        learnFromExpense(group.id, input.description, input.category).catch((e) => {
          // Auth errors go to system_logs (Issue #164); other errors stay silent
          // since rule learning is best-effort and must never block save UX.
          if (isAuthError(e)) logger.error('[ExpenseForm] learnFromExpense auth error', e)
        })
        // Clear draft after successful save
        if (draftKey && typeof window !== 'undefined') {
          sessionStorage.removeItem(draftKey)
        }
        hapticFeedback('success')
        onSaved()
      } catch (e: unknown) {
        if (e instanceof ReceiptUploadError) setError(`圖片上傳失敗：${e.message}`)
        else setError(e instanceof Error ? e.message : '儲存失敗')
        hapticFeedback('error')
      } finally {
        setUploadProgress({ current: 0, total: 0 })
      }
    })
  }

  const amt = parseFloat(amount) || 0
  const pCount = participantIds.size || 1

  // Compute derived values for real-time indicators
  const percentParticipants = members.filter((m) => participantIds.has(m.id))
  const percentTotal = percentParticipants.reduce((s, m) => s + (percentages[m.id] ?? 0), 0)
  const customParticipants = members.filter((m) => participantIds.has(m.id))
  const customTotal = customParticipants.reduce((s, m) => s + (customAmounts[m.id] ?? 0), 0)
  const weightParticipants = members.filter((m) => participantIds.has(m.id))
  const totalWeight = weightParticipants.reduce((s, m) => s + (weights[m.id] ?? 1), 0)

  return (
    <div className="space-y-5">
      {/* 草稿恢復 banner */}
      {hasDraft && !draftRestored && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3"
          style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 92%)' }}
        >
          <span className="text-lg" aria-hidden>📝</span>
          <div className="flex-1 text-sm">
            <div className="font-medium">發現未完成的記帳草稿</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
              要繼續上次的編輯嗎？
            </div>
          </div>
          <button
            onClick={restoreDraft}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            恢復
          </button>
          <button
            onClick={dismissDraft}
            className="text-xs px-2 py-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            捨棄
          </button>
        </div>
      )}

      {/* 日期 */}
      <div>
        <label className="text-sm font-medium mb-1 block">日期</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
      </div>

      {/* 描述（含自動完成） */}
      <div className="relative">
        <label className="text-sm font-medium mb-1 block">描述</label>
        <input type="text" value={description} placeholder="例如：晚餐、加油、水費..."
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
        {showSuggestions && filteredDescs.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
            {filteredDescs.map((d) => (
              <button key={d} className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--muted)] transition"
                onMouseDown={() => { setDescription(d); setShowSuggestions(false) }}>
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 金額 — 支援 700+150 四則運算 (Issue #220) */}
      <div>
        <label className="text-sm font-medium mb-1 block">金額</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">NT$</span>
          <input type="text" inputMode="decimal" value={amount} placeholder="0 或 700+150"
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              const r = evaluateAmountExpression(amount)
              if (r.ok) setAmount(String(r.value))
            }}
            className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] pl-12 pr-3 text-sm" />
        </div>
        <AmountChips value={amount} onChange={setAmount} className="mt-2" />
      </div>

      {/* Possible-duplicate warning (Issue #211). Shown only when description +
          amount both filled AND another family member already recorded a near-
          identical expense in the last 5 min. User can dismiss per candidate. */}
      {showDuplicateWarning && possibleDuplicate && (
        <div
          className="rounded-lg border p-3 flex items-start gap-3 text-xs"
          style={{
            borderColor: 'color-mix(in oklch, var(--primary), transparent 60%)',
            backgroundColor: 'color-mix(in oklch, var(--primary), transparent 92%)',
          }}
          role="alert"
          aria-live="polite"
        >
          <span className="text-lg">📋</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium">似乎重複了？</div>
            <div className="text-[var(--muted-foreground)] mt-0.5">
              {possibleDuplicate.createdBy && possibleDuplicate.createdBy === user?.uid ? (
                <>
                  你先前已記過
                  <span className="font-medium text-[var(--foreground)]"> 「{possibleDuplicate.description}」</span>
                  （NT$ {possibleDuplicate.amount.toLocaleString()}），確定要再記一筆？
                </>
              ) : (
                <>
                  <span className="font-medium text-[var(--foreground)]">{possibleDuplicate.payerName}</span> 剛剛記了
                  <span className="font-medium text-[var(--foreground)]"> 「{possibleDuplicate.description}」</span>
                  （NT$ {possibleDuplicate.amount.toLocaleString()}），確定要再記一筆？
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedDuplicateKey(duplicateKey)}
            aria-label="忽略重複提醒"
            className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Amount outlier warning (Issue #284) — heuristic typo detection
          based on this group's history of the same category. */}
      {showOutlierWarning && outlierResult && (
        <div
          className="rounded-lg border p-3 flex items-start gap-3 text-xs"
          style={{
            borderColor: 'color-mix(in oklch, oklch(0.80 0.15 75), var(--card) 40%)',
            backgroundColor: 'color-mix(in oklch, oklch(0.85 0.10 75), var(--card) 80%)',
          }}
          role="alert"
          aria-live="polite"
        >
          <span className="text-lg">⚠️</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium">金額看起來不太一樣</div>
            <div className="text-[var(--muted-foreground)] mt-0.5">
              {outlierResult.kind === 'digit_jump' ? (
                <>
                  「{category}」過去通常在
                  <span className="font-medium text-[var(--foreground)]">
                    {' '}NT${' '}
                    {outlierResult.historicalMedian?.toLocaleString() ?? ''}{' '}
                  </span>
                  左右，這筆是不是多打了 0？
                </>
              ) : (
                <>
                  「{category}」過去中位數是
                  <span className="font-medium text-[var(--foreground)]">
                    {' '}NT${' '}
                    {outlierResult.historicalMedian?.toLocaleString() ?? ''}
                  </span>
                  ，這筆比平常高 5 倍以上，確定金額正確？
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedOutlierKey(outlierKey)}
            aria-label="忽略金額提醒"
            className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 類別 */}
      <div>
        <label className="text-sm font-medium mb-1 flex items-center gap-2">
          類別
          {autoCategoryFilled && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--primary)]/10 text-[var(--primary)]"
              title="根據過去記錄自動分類，你可以手動修改"
            >
              ⚡ 自動分類
            </span>
          )}
        </label>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setAutoCategoryFilled(false) }}
          className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm">
          {categoryGroups.map((group) => {
            // If a top-level category has children, render as optgroup with parent itself + children
            if (group.parent && group.children.length > 0) {
              return (
                <optgroup key={group.parent} label={group.parent}>
                  <option value={group.parent}>{group.parent}</option>
                  {group.children.map((c) => <option key={c} value={c}>&emsp;{c}</option>)}
                </optgroup>
              )
            }
            // Top-level without children — flat option
            return group.parent
              ? <option key={group.parent} value={group.parent}>{group.parent}</option>
              : group.children.map((c) => <option key={c} value={c}>{c}</option>)
          })}
        </select>
        {(() => {
          // Hint: "上次此類別金額" (Issue #252). Only show when there's a
          // distinct previous record — exclude the expense currently being
          // edited so it doesn't cite itself.
          if (!category) return null
          const match = findLastExpenseByCategory(expenses, category, existingExpense?.id)
          if (!match) return null
          return (
            <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
              💡 上次「{category}」：<span className="font-medium text-[var(--foreground)]">{fmtCurrency(match.expense.amount)}</span>
              <span className="ml-1">（{relativeDays(match.date, new Date())}）</span>
            </p>
          )
        })()}
      </div>

      {/* 付款方式 */}
      <div>
        <label className="text-sm font-medium mb-1 block">付款方式</label>
        <div className="flex gap-2">
          {([['cash', '💵 現金'], ['creditCard', '💳 信用卡']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPaymentMethod(v)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border transition ${
                paymentMethod === v
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[var(--border)] hover:bg-[var(--muted)]'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 支出類型 */}
      <div>
        <label className="text-sm font-medium mb-1 block">支出類型</label>
        <div className="flex gap-2">
          {[{ v: false, l: '👤 個人支出' }, { v: true, l: '👥 共同支出' }].map(({ v, l }) => (
            <button key={String(v)} onClick={() => setIsShared(v)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border transition ${
                isShared === v
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[var(--border)] hover:bg-[var(--muted)]'
              }`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 付款人 — chips (Issue #258) */}
      <div>
        <label className="text-sm font-medium mb-1 block">付款人</label>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const selected = payerId === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPayerId(m.id)}
                aria-pressed={selected}
                className={`px-3 h-9 rounded-lg text-sm font-medium border transition ${
                  selected
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border-[var(--border)] hover:bg-[var(--muted)]'
                }`}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* 分帳設定 */}
      {isShared && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <label className="text-sm font-medium block">分帳方式</label>
          <div className="grid grid-cols-4 gap-2">
            {([['equal', '均分'], ['weight', '加權'], ['percentage', '比例'], ['custom', '自訂']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setSplitMethod(v)}
                className={`h-9 rounded-lg text-sm font-medium border transition ${
                  splitMethod === v
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border-[var(--border)] hover:bg-[var(--muted)]'
                }`}>{l}</button>
            ))}
          </div>

          {/* 參與者 */}
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const selected = participantIds.has(m.id)
              return (
                <button key={m.id} onClick={() => {
                  const next = new Set(participantIds)
                  if (selected && next.size > 1) next.delete(m.id); else next.add(m.id)
                  setParticipantIds(next)
                }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selected
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]'
                  }`}>{m.name}</button>
              )
            })}
          </div>

          {/* 比例輸入 */}
          {splitMethod === 'percentage' && (
            <>
              {percentParticipants.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-16 text-sm">{m.name}</span>
                  <input type="number" placeholder="%" value={percentages[m.id] ?? ''}
                    onChange={(e) => setPercentages({ ...percentages, [m.id]: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                    className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
                  <span className="text-xs text-[var(--muted-foreground)]">%</span>
                </div>
              ))}
              <div className={`text-xs ${percentTotal !== 100 ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}`}>
                目前合計: {percentTotal}%{percentTotal !== 100 ? ' （須等於 100%）' : ''}
              </div>
            </>
          )}

          {/* 加權輸入 */}
          {splitMethod === 'weight' && (
            <>
              <div className="text-xs text-[var(--muted-foreground)]">
                💡 適合情侶 2:1、大人 2、小孩 1 等場景
              </div>
              {weightParticipants.map((m) => {
                const w = weights[m.id] ?? 1
                const pct = totalWeight > 0 ? ((w / totalWeight) * 100) : 0
                const myAmt = totalWeight > 0 ? Math.round((amt * w) / totalWeight) : 0
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="w-16 text-sm">{m.name}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      placeholder="權重"
                      value={w}
                      onChange={(e) => setWeights({ ...weights, [m.id]: Math.max(1, Math.round(parseFloat(e.target.value) || 1)) })}
                      className="w-20 h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-center"
                    />
                    <span className="flex-1 text-xs text-[var(--muted-foreground)]">
                      = {pct.toFixed(0)}% · NT$ {myAmt.toLocaleString()}
                    </span>
                  </div>
                )
              })}
              <div className="text-xs text-[var(--muted-foreground)]">
                總權重 {totalWeight}
              </div>
            </>
          )}

          {/* 自訂金額輸入 */}
          {splitMethod === 'custom' && (
            <>
              {customParticipants.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-16 text-sm">{m.name}</span>
                  <input type="number" placeholder="NT$" value={customAmounts[m.id] ?? ''}
                    onChange={(e) => setCustomAmounts({ ...customAmounts, [m.id]: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="flex-1 h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm" />
                </div>
              ))}
              <div className={`text-xs ${amt > 0 && customTotal !== amt ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}`}>
                已分配 NT$ {customTotal} / NT$ {amt}{amt > 0 && customTotal !== amt ? ' （總和須等於支出金額）' : ''}
              </div>
            </>
          )}

          {/* 預覽 */}
          {amt > 0 && (
            <div className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 90%)' }}>
              <div className="font-medium">拆帳預覽</div>
              {splitMethod === 'equal' && <div>每人 NT$ {Math.round(amt / pCount)}（共 {pCount} 人）</div>}
              {splitMethod === 'percentage' && percentParticipants.map((m) => (
                <div key={m.id}>{m.name}：{percentages[m.id] ?? 0}% = NT$ {Math.round(amt * (percentages[m.id] ?? 0) / 100)}</div>
              ))}
              {splitMethod === 'custom' && customParticipants.map((m) => (
                <div key={m.id}>{m.name}：NT$ {customAmounts[m.id] ?? 0}</div>
              ))}
              {splitMethod === 'weight' && weightParticipants.map((m) => {
                const w = weights[m.id] ?? 1
                const myAmt = totalWeight > 0 ? Math.round((amt * w) / totalWeight) : 0
                return <div key={m.id}>{m.name}（權重 {w}）：NT$ {myAmt.toLocaleString()}</div>
              })}
            </div>
          )}
        </div>
      )}

      {/* 備註 */}
      <div>
        <label className="text-sm font-medium mb-1 block">備註（可選）</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="備註..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm resize-none" />
      </div>

      {/* 收據圖片（最多 10 張） */}
      <div>
        <label className="text-sm font-medium mb-1 flex items-center gap-2">
          📷 收據圖片（可選）
          <span className="text-xs text-[var(--muted-foreground)]">
            {totalImageCount}/{MAX_RECEIPTS_PER_EXPENSE}
          </span>
        </label>
        {isEditing && existingReceiptPaths.length > 0 && (
          <p className="text-xs text-[var(--muted-foreground)] mb-2">
            💡 點縮圖可檢視原圖，確認後再決定要保留或刪除。
          </p>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {existingReceiptPaths.map((p, i) => (
            <div
              key={p}
              className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--muted)]"
            >
              {existingReceiptUrls[p] ? (
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="block w-full h-full"
                  aria-label={`檢視第 ${i + 1} 張收據`}
                >
                  <img
                    src={existingReceiptUrls[p]}
                    alt={`收據 ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">
                  載入中…
                </div>
              )}
              <button
                type="button"
                onClick={() => removeExistingPath(p)}
                aria-label={`刪除第 ${i + 1} 張收據`}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white text-sm flex items-center justify-center hover:bg-black/90 active:scale-95"
              >✕</button>
              <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white font-medium">
                {i + 1}
              </span>
            </div>
          ))}
          {newFiles.map((f, i) => {
            const displayIdx = existingReceiptPaths.length + i + 1
            return (
              <div
                key={`${f.name}-${i}`}
                className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--muted)]"
              >
                <img
                  src={newFilePreviews[i]}
                  alt={`待上傳 ${displayIdx}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewFile(i)}
                  aria-label="移除待上傳圖片"
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white text-sm flex items-center justify-center hover:bg-black/90 active:scale-95"
                >✕</button>
                <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] font-medium">
                  新 {displayIdx}
                </span>
              </div>
            )
          })}
          {canAddMore && (
            <label className="aspect-square rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-1 text-xs text-[var(--muted-foreground)] cursor-pointer hover:bg-[var(--muted)] transition">
              <span className="text-2xl">＋</span>
              <span>新增圖片</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesPicked}
              />
            </label>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          送出時才上傳。可從相機或相簿選取，上傳前會自動壓縮。
        </p>
      </div>

      {galleryOpen && existingReceiptPaths.length > 0 && (
        <ReceiptGallery paths={existingReceiptPaths} onClose={() => setGalleryOpen(false)} />
      )}

      {/* 設為定期 — 僅新增模式顯示 */}
      {!isEditing && (
        <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={setAsRecurring} onChange={(e) => setSetAsRecurring(e.target.checked)}
              className="w-4 h-4 rounded" />
            <span className="text-sm font-medium">🔁 同時設為每月定期支出</span>
          </label>
          {setAsRecurring && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <span>每月</span>
              <select value={recurringDayOfMonth}
                onChange={(e) => setRecurringDayOfMonth(Number(e.target.value))}
                className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm">
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span>號自動記錄</span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>}

      {/* 儲存 — 可見按鈕只顯示 label；螢幕閱讀器透過下方 live region 接收進度更新。
          aria-live 不放在 <button> 上：NVDA/VoiceOver 對 interactive widget 上的
          live 屬性支援不一致，分開 sibling role="status" 是最可靠的做法。 */}
      <button onClick={handleSave} disabled={saving}
        className="w-full h-12 rounded-xl font-semibold btn-primary btn-press">
        {saveButtonLabel({ saving, isEditing, uploadProgress })}
      </button>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {saving ? saveButtonLabel({ saving, isEditing, uploadProgress }) : ''}
      </div>
    </div>
  )
}
