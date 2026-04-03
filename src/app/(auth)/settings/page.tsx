'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useCurrentMember } from '@/lib/hooks/use-current-member'
import { useCategories } from '@/lib/hooks/use-categories'
import { useColorTheme, COLOR_THEMES } from '@/lib/hooks/use-color-theme'
import { addMember, removeMember, updateMember } from '@/lib/services/member-service'
import { createGroup, updateGroup, deleteGroup, refreshInviteCode, joinGroupByInviteCode } from '@/lib/services/group-service'
import { addCategory, updateCategory } from '@/lib/services/category-service'
import { addActivityLog } from '@/lib/services/activity-log-service'
import { useRouter } from 'next/navigation'
import type { FamilyMember, Category } from '@/lib/types'

import { logger } from '@/lib/logger'

// ── Section wrapper ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h2 className="font-semibold text-sm text-[var(--muted-foreground)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Members section ────────────────────────────────────────────

function MembersSection({ groupId }: { groupId: string }) {
  const { members, loading: membersLoading } = useMembers(groupId)
  const { currentMemberId, setCurrentMember, loading: currentMemberLoading } = useCurrentMember(groupId)
  const { user } = useAuth()
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      await addMember(groupId, name, 'member', user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
      setNewName('')
    } catch (e) {
      logger.error('[Settings] Failed to add member:', e)
      alert('新增失敗，請稍後再試')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(memberId: string, memberName: string) {
    if (!confirm(`確定要刪除成員「${memberName}」嗎？此操作無法復原。`)) return
    try {
      await removeMember(groupId, memberId, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined, memberName)
    } catch (e) {
      logger.error('[Settings] Failed to delete member:', e)
      alert('刪除失敗，請稍後再試')
    }
  }

  async function handleRename(memberId: string) {
    const name = editName.trim()
    if (!name) return
    try {
      await updateMember(groupId, memberId, { name })
      setEditingId(null)
    } catch (e) {
      logger.error('[Settings] Failed to rename member:', e)
      alert('重新命名失敗，請稍後再試')
    }
  }

  async function handleSetCurrentMember(member: FamilyMember) {
    // If already selected, do nothing
    if (currentMemberId === member.id) return
    try {
      await setCurrentMember(member.id)
      if (user) {
        try {
          await addActivityLog(groupId, {
            action: 'member_updated',
            actorId: user.uid,
            actorName: user.displayName ?? '未知',
            description: `設為我：${member.name}`,
            entityId: member.id,
          })
        } catch (e) {
          logger.error('[Settings] Failed to log activity:', e)
        }
      }
    } catch (e) {
      logger.error('[Settings] Failed to set current member:', e)
      alert('更新失敗，請稍後再試')
    }
  }

  const isLoading = membersLoading || currentMemberLoading

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">載入中...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">還沒有成員，請新增</p>
      ) : null}
      {members.map((m) => {
        const isMe = currentMemberId === m.id
        return (
          <div key={m.id} className="flex items-center gap-2">
            {editingId === m.id ? (
              <>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(m.id)}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <button onClick={() => handleRename(m.id)}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-white"
                  style={{ backgroundColor: 'var(--primary)' }}>儲存</button>
                <button onClick={() => setEditingId(null)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">取消</button>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 80%)', color: 'var(--primary)' }}>
                  {m.name.slice(0, 1)}
                </div>
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                {isMe && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">我</span>
                )}
                {!isMe && (
                  <button onClick={() => handleSetCurrentMember(m)}
                    className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]">
                    設為我
                  </button>
                )}
                <button onClick={() => { setEditingId(m.id); setEditName(m.name) }}
                  className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]">改名</button>
                <button onClick={() => handleDelete(m.id, m.name)}
                  className="text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-[var(--destructive)]">刪除</button>
              </>
            )}
          </div>
        )
      })}
      <div className="flex gap-2 pt-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="輸入成員姓名"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button onClick={handleAdd} disabled={adding || !newName.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}>新增</button>
      </div>
    </div>
  )
}

// ── Categories section ─────────────────────────────────────────

const EMOJI_PRESETS = ['🍜', '🚌', '🛒', '🏠', '💡', '🏥', '🎮', '👨‍👩‍👧', '📚', '🧴', '📱', '💰', '✈️', '🎁', '⚽', '🐾']

function CategoriesSection({ groupId }: { groupId: string }) {
  const { categories } = useCategories(groupId)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('💰')
  const [adding, setAdding] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      await addCategory(groupId, { name, icon: newIcon, sortOrder: categories.length })
      setNewName('')
      setShowEmojiPicker(false)
    } catch (e) {
      logger.error('[Settings] Failed to add category:', e)
      alert('新增失敗，請稍後再試')
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleActive(cat: Category) {
    if (!cat.id || cat.isDefault) return
    try {
      await updateCategory(groupId, cat.id, { isActive: !cat.isActive })
    } catch (e) {
      logger.error('[Settings] Failed to toggle category:', e)
      alert('更新失敗，請稍後再試')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">暫無分類，請新增</p>
        )}
        {categories.map((c) => (
          <button key={c.id ?? c.name} onClick={() => handleToggleActive(c)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              c.isActive
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] opacity-50'
            } ${c.isDefault ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}>
            <span>{c.icon}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <div className="relative">
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-10 h-10 rounded-lg border border-[var(--border)] text-lg flex items-center justify-center hover:bg-[var(--muted)]">
            {newIcon}
          </button>
          {showEmojiPicker && (
            <div className="absolute top-12 left-0 z-20 p-2 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg grid grid-cols-4 gap-1 w-44">
              {EMOJI_PRESETS.map((e) => (
                <button key={e} onClick={() => { setNewIcon(e); setShowEmojiPicker(false) }}
                  className="w-9 h-9 text-lg rounded hover:bg-[var(--muted)] flex items-center justify-center">{e}</button>
              ))}
            </div>
          )}
        </div>
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="分類名稱"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
        <button onClick={handleAdd} disabled={adding || !newName.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}>新增</button>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">點擊可切換啟用／停用（預設分類不可停用）</p>
    </div>
  )
}

// ── Theme section ──────────────────────────────────────────────

function ThemeSection() {
  const { theme, setTheme } = useTheme()
  const { colorTheme, setColorTheme } = useColorTheme()

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">外觀模式</p>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)}
              className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                theme === t
                  ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
              }`}>
              {{ light: '☀️ 亮色', dark: '🌙 暗色', system: '🖥️ 系統' }[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">主題色系</p>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_THEMES.map((ct) => (
            <button key={ct.id} onClick={() => setColorTheme(ct.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                colorTheme === ct.id
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-1'
                  : 'border-[var(--border)] hover:border-[var(--primary)]'
              }`}>
              <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: ct.color }} />
              <span className="text-sm">{ct.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Gemini API Key section ─────────────────────────────────────

const GEMINI_KEY = 'gemini-api-key'

function ApiKeySection() {
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)

  // Hydrate from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    setKey(localStorage.getItem(GEMINI_KEY) ?? '')
  }, [])
  const [saved, setSaved] = useState(false)

  function handleSave() {
    const trimmed = key.trim()
    if (trimmed) {
      localStorage.setItem(GEMINI_KEY, trimmed)
    } else {
      localStorage.removeItem(GEMINI_KEY)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        用於語音輸入的 AI 解析功能。Key 僅儲存於您的瀏覽器，不傳送至伺服器。
      </p>
      <div className="flex gap-2">
        <input type={show ? 'text' : 'password'} value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIzaSy..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
        <button onClick={() => setShow(!show)}
          className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--muted)]">
          {show ? '隱藏' : '顯示'}
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          {saved ? '已儲存 ✓' : '儲存'}
        </button>
        {key && (
          <button onClick={() => { setKey(''); localStorage.removeItem(GEMINI_KEY) }}
            className="px-4 py-2 rounded-lg text-sm border border-[var(--destructive)] text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-950">
            清除
          </button>
        )}
      </div>
    </div>
  )
}

// ── Group Management section ─────────────────────────────────

function InviteCodeBlock({ group }: { group: { id: string; name: string; inviteCode?: string | null } }) {
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      await refreshInviteCode(group.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '產生邀請碼失敗'
      setError(msg.includes('permission') ? '沒有權限，請聯絡群組擁有者' : msg)
      logger.error('[Settings] Failed to generate invite code:', e)
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy() {
    if (!group.inviteCode) return
    navigator.clipboard.writeText(group.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShareLink() {
    if (!group.inviteCode) return
    const url = `${window.location.origin}/family-ledger-web/settings?join=${group.inviteCode}`
    if (navigator.share) {
      navigator.share({ title: `加入「${group.name}」`, text: `邀請碼：${group.inviteCode}`, url }).catch(() => {
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] p-3 space-y-2">
      <div className="text-xs text-[var(--muted-foreground)]">
        邀請碼 — {group.name}
      </div>
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
      {group.inviteCode ? (
        <div className="space-y-2">
          <code className="block text-center text-2xl font-mono font-bold tracking-[0.3em] py-2 rounded-lg bg-[var(--muted)]">
            {group.inviteCode}
          </code>
          <div className="flex gap-2">
            <button onClick={handleCopy}
              className="flex-1 text-xs py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">
              {copied ? '已複製 ✓' : '📋 複製'}
            </button>
            <button onClick={handleShareLink}
              className="flex-1 text-xs py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">
              📤 分享
            </button>
            <button onClick={handleGenerate} disabled={generating}
              className="flex-1 text-xs py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]">
              🔄 重新產生
            </button>
          </div>
        </div>
      ) : (
        <button onClick={handleGenerate} disabled={generating}
          className="w-full py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-[var(--muted)] transition">
          {generating ? '產生中...' : '產生邀請碼'}
        </button>
      )}
    </div>
  )
}

function JoinGroupBlock() {
  const { setActiveGroupId } = useGroup()
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const joinParam = searchParams?.get('join')?.toUpperCase() ?? ''
  const [code, setCode] = useState(joinParam)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const autoJoinTriggered = useRef(false)

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setJoining(true)
    setError(null)
    setSuccess(null)
    try {
      const groupId = await joinGroupByInviteCode(trimmed)
      setActiveGroupId(groupId)
      setCode('')
      setSuccess('成功加入群組！')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失敗')
    } finally {
      setJoining(false)
    }
  }

  // Auto-join when opened via invite link (?join=XXXXXX)
  useEffect(() => {
    if (joinParam && joinParam.length === 6 && !autoJoinTriggered.current) {
      autoJoinTriggered.current = true
      handleJoin()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinParam])

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] p-3 space-y-2">
      <div className="text-xs text-[var(--muted-foreground)]">輸入邀請碼加入群組</div>
      <div className="flex gap-2 overflow-hidden">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="邀請碼"
          maxLength={6}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm font-mono text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button onClick={handleJoin} disabled={joining || code.trim().length !== 6}
          className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}>
          {joining ? '...' : '加入'}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
    </div>
  )
}

function GroupManagementSection() {
  const { group, groups, setActiveGroupId, removeGroup } = useGroup()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    try {
      const id = await createGroup(trimmed, groups.length === 0)
      setNewName('')
      setActiveGroupId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '建立失敗，請重試')
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(groupId: string) {
    const trimmed = editName.trim()
    if (!trimmed) return
    try {
      await updateGroup(groupId, { name: trimmed })
      setEditingId(null)
    } catch (e) {
      logger.error('[Settings] Failed to rename group:', e)
      alert('重新命名失敗')
    }
  }

  async function handleDelete(groupId: string, groupName: string) {
    if (groups.length <= 1) {
      alert('至少要保留一個群組')
      return
    }
    if (!confirm(`確定要刪除群組「${groupName}」嗎？所有支出、結算紀錄都會一併刪除，此操作無法復原。`)) return
    try {
      await deleteGroup(groupId)
      // 刪除成功後切換 active group（snapshot 會自動移除已刪群組）
      if (group?.id === groupId) {
        const remaining = groups.find((g) => g.id !== groupId)
        if (remaining) setActiveGroupId(remaining.id)
      }
      removeGroup(groupId)
    } catch (e) {
      logger.error('[Settings] Failed to delete group:', e)
      alert('刪除失敗')
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.id} className="flex items-center gap-2">
          {editingId === g.id ? (
            <>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(g.id)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <button onClick={() => handleRename(g.id)}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium text-white"
                style={{ backgroundColor: 'var(--primary)' }}>儲存</button>
              <button onClick={() => setEditingId(null)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">取消</button>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: 'color-mix(in oklch, var(--primary), transparent 80%)', color: 'var(--primary)' }}>
                {g.name.slice(0, 1)}
              </div>
              <span className="flex-1 text-sm font-medium">{g.name}</span>
              {g.id === group?.id && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">目前</span>
              )}
              <button onClick={() => { setEditingId(g.id); setEditName(g.name) }}
                className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]">改名</button>
              {groups.length > 1 && (
                <button onClick={() => handleDelete(g.id, g.name)}
                  className="text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-[var(--destructive)]">刪除</button>
              )}
            </>
          )}
        </div>
      ))}

      {/* 邀請碼 */}
      {group && <InviteCodeBlock group={group} />}

      {/* 加入群組 */}
      <JoinGroupBlock />

      <div className="flex gap-2 pt-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="新群組名稱"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button onClick={handleCreate} disabled={creating || !newName.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}>
          {creating ? '建立中...' : '+ 新增群組'}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { group, loading } = useGroup()
  const router = useRouter()

  async function handleSignOut() {
    if (!confirm('確定要登出嗎？')) return
    await signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">⚙️ 設定</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Section title="📂 群組管理">
          <GroupManagementSection />
        </Section>

        <Section title={`👥 成員管理${group ? ` — ${group.name}` : ''}`}>
          {group
            ? <MembersSection groupId={group.id} />
            : <p className="text-sm text-[var(--muted-foreground)]">請先建立群組</p>}
        </Section>

        {group && (
          <Section title="🏷️ 支出分類">
            <CategoriesSection groupId={group.id} />
          </Section>
        )}

        <Section title="🎨 外觀與主題">
          <ThemeSection />
        </Section>

        <Section title="🤖 Gemini API Key">
          <ApiKeySection />
        </Section>

        <Section title="👤 帳號">
        <div className="flex items-center gap-4">
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user?.displayName ?? '使用者'}</p>
            <p className="text-sm text-[var(--muted-foreground)] truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--destructive)] text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            登出
          </button>
        </div>
      </Section>

      </div>{/* end grid */}

      <p className="text-center text-xs text-[var(--muted-foreground)] pb-2">
        家計本 Web · Phase 5
      </p>
    </div>
  )
}
