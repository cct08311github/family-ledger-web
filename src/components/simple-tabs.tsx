'use client'

interface SimpleTab<K extends string> {
  key: K
  label: string
}

interface SimpleTabsProps<K extends string> {
  tabs: readonly SimpleTab<K>[]
  active: K
  onChange: (_next: K) => void
  className?: string
  /** Optional right-aligned slot for actions (links, badges, etc.). */
  rightSlot?: React.ReactNode
}

/**
 * Lightweight horizontal tab bar — one underline-style segmented control
 * used for "今日 / 本週" and "記錄 / 動態" on the home page (Issue #222).
 * Keeps the same visual language as the existing pill toggles on /records.
 */
export function SimpleTabs<K extends string>({
  tabs,
  active,
  onChange,
  className,
  rightSlot,
}: SimpleTabsProps<K>) {
  return (
    <div className={`flex items-center justify-between ${className ?? ''}`}>
      <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1" role="tablist">
        {tabs.map((t) => {
          const selected = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selected
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {rightSlot}
    </div>
  )
}
