'use client'

import { useState, useEffect } from 'react'
import { writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTheme } from 'next-themes'
import { useAuth } from '@/lib/auth'
import { useGroup } from '@/lib/hooks/use-group'
import { useMembers } from '@/lib/hooks/use-members'
import { useCategories } from '@/lib/hooks/use-categories'
import { useColorTheme, COLOR_THEMES } from '@/lib/hooks/use-color-theme'
import { addMember, removeMember, updateMember } from '@/lib/services/member-service'
import { createGroup } from '@/lib/services/group-service'
import { addCategory, updateCategory } from '@/lib/services/category-service'
import { addActivityLog } from '@/lib/services/activity-log-service'
import { useRouter } from 'next/navigation'
import type { FamilyMember, Category } from '@/lib/types'

import { logger } from '@/lib/logger'

// ── Section wrapper ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
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

  async function handleDelete(memberId: string, memberName: string, isCurrentUser: boolean) {
    if (!confirm(`確定要刪除成員「${memberName}」嗎？此操作無法復原。`)) return
    try {
      await removeMember(groupId, memberId, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined, memberName, isCurrentUser)
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

  async function handleToggleCurrent(member: FamilyMember) {
    const next = !member.isCurrentUser
    const batch = writeBatch(db)
    // Atomically update both members in one batch to avoid intermediate inconsistent state
    if (next) {
      const prev = members.find((m) => m.isCurrentUser && m.id !== member.id)
      if (prev) batch.update(doc(db, 'groups', groupId, 'members', prev.id), { isCurrentUser: false })
    }
    batch.update(doc(db, 'groups', groupId, 'members', member.id), { isCurrentUser: next })
    try {
      await batch.commit()
      if (next && user) {
        try {
          await addActivityLog(groupId, {
            action: 'member_updated',
            actorId: user.uid,
            actorName: user.displayName ?? '未知',
            description: `切換目前成員：${member.name}`,
            entityId: member.id,
          })
        } catch (e) {
          logger.error('[Settings] Failed to log activity:', e)
        }
      }
    } catch (e) {
      logger.error('[Settings] Failed to toggle current user:', e)
      alert('更新失敗，請稍後再試')
    }
  }

  return (
    <div className="space-y-3">
      {membersLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">載入中...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">還沒有成員，請新增</p>
      ) : null}
      {members.map((m) => (
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
              {m.isCurrentUser && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">我</span>
              )}
              <button onClick={() => handleToggleCurrent(m)}
                className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]">
                {m.isCurrentUser ? '取消' : '設為我'}
              </button>
              <button onClick={() => { setEditingId(m.id); setEditName(m.name) }}
                className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]">改名</button>
              <button onClick={() => handleDelete(m.id, m.name, m.isCurrentUser)}
                className="text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-[var(--destructive)]">刪除</button>
            </>
          )}
        </div>
      ))}
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

// ── Create Group section ──────────────────────────────────────

function CreateGroupSection() {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    try {
      await createGroup(trimmed)
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '建立失敗，請重試')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">建立你的第一個家庭群組來開始記帳</p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="例如：我的家庭"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {creating ? '建立中...' : '建立'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-[var(--destructive)]">{error}</p>
      )}
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
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">⚙️ 設定</h1>

      <Section title="👥 成員管理">
        {group
          ? <MembersSection groupId={group.id} />
          : <CreateGroupSection />}
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

      <p className="text-center text-xs text-[var(--muted-foreground)] pb-2">
        家計本 Web · Phase 5
      </p>
    </div>
  )
}
