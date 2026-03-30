'use client'

import { useState } from 'react'
import { useGroup } from '@/lib/hooks/use-group'
import { useCategories } from '@/lib/hooks/use-categories'
import { addCategory, updateCategory, deleteCategory, reorderCategories } from '@/lib/services/category-service'
import { useAuth } from '@/lib/auth'
import type { Category } from '@/lib/types'

const ICONS = ['🍜', '🚗', '🛒', '🏠', '💡', '🏥', '🎬', '💰', '📚', '👶', '🧴', '📱', '✈️', '🎁', '其他']

interface CategoryFormData {
  name: string
  icon: string
}

export default function CategoriesPage() {
  const { group } = useGroup()
  const categories = useCategories(group?.id)
  const { user } = useAuth()

  const [editing, setEditing] = useState<Category | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CategoryFormData>({ name: '', icon: '📱' })
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setEditing(null)
    setForm({ name: '', icon: '📱' })
    setShowForm(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, icon: cat.icon })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !group) return
    setSaving(true)
    try {
      if (editing?.id) {
        await updateCategory(group.id, editing.id, { name: form.name.trim(), icon: form.icon }, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
      } else {
        await addCategory(group.id, {
          name: form.name.trim(),
          icon: form.icon,
          sortOrder: categories.length,
        }, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined)
      }
      setShowForm(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    if (!group || !cat.id || !confirm(`確定刪除「${cat.name}」？`)) return
    try {
      await deleteCategory(group.id, cat.id, user ? { id: user.uid, name: user.displayName ?? '未知' } : undefined, cat.name)
    } catch (e) {
      console.error('[Categories] Failed to delete category:', e)
      alert('刪除失敗，請稍後再試')
    }
  }

  async function handleReorder(fromIndex: number, direction: 'up' | 'down') {
    if (!group) return
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= categories.length) return
    const reordered = [...categories]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    try {
      await reorderCategories(group.id, reordered.map((c) => c.id).filter((id): id is string => !!id))
    } catch (e) {
      console.error('[Categories] Failed to reorder categories:', e)
      alert('排序失敗，請稍後再試')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">類別管理</h1>
        <button
          onClick={openAdd}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          ＋ 新增類別
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <div className="text-4xl opacity-30">📂</div>
          <p className="text-[var(--muted-foreground)]">還沒有自訂類別</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0"
            >
              <span className="text-xl flex-shrink-0">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{cat.name}</div>
                {cat.isDefault && (
                  <span className="text-xs text-[var(--muted-foreground)]">預設</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleReorder(i, 'up')}
                  disabled={i === 0}
                  className="w-7 h-7 rounded text-xs hover:bg-[var(--muted)] disabled:opacity-30 transition-colors"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleReorder(i, 'down')}
                  disabled={i === categories.length - 1}
                  className="w-7 h-7 rounded text-xs hover:bg-[var(--muted)] disabled:opacity-30 transition-colors"
                >
                  ↓
                </button>
              </div>
              <button
                onClick={() => openEdit(cat)}
                className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
              >
                編輯
              </button>
              {!cat.isDefault && (
                <button
                  onClick={() => handleDelete(cat)}
                  className="text-xs px-2 py-1 rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
                >
                  刪除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold">{editing ? '編輯類別' : '新增類別'}</h2>

            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">名稱</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder="例如：餐飲"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">圖示</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setForm({ ...form, icon })}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${
                      form.icon === icon
                        ? 'border-2'
                        : 'border border-[var(--border)] hover:bg-[var(--muted)]'
                    }`}
                    style={form.icon === icon ? { borderColor: 'var(--primary)' } : {}}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
