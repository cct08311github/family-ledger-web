export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--primary)]" />
        <p className="text-sm text-[var(--muted-foreground)]">載入中...</p>
      </div>
    </div>
  )
}
