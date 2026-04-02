'use client'

import { useState, useRef, useEffect } from 'react'
import { useGroup } from '@/lib/hooks/use-group'

export function GroupSwitcher() {
  const { group, groups, setActiveGroupId } = useGroup()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (groups.length <= 1) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-[var(--muted)] transition-colors w-full"
      >
        <span className="truncate flex-1 text-left">{group?.name ?? '選擇群組'}</span>
        <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden z-50">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setActiveGroupId(g.id)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                g.id === group?.id
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-medium'
                  : 'hover:bg-[var(--muted)]'
              }`}
            >
              {g.name}
              {g.isPrimary && g.id !== group?.id && (
                <span className="ml-1.5 text-xs opacity-60">主要</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
