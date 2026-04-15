# Receipt Paths Migration

Migrate legacy `expenses.receiptPath: string` → `expenses.receiptPaths: string[]`.

## Why

Issue #150 introduced multi-image receipts. New writes use `receiptPaths`, but existing
records still carry the old single-string `receiptPath`. The read path handles both via
`normalizeReceiptPaths()`, but this migration converts legacy data once so we can drop
the compatibility fallback in a future release.

## Run (browser console, logged in as a group admin)

1. Open the deployed app and sign in as a **group owner** (Firestore rules require it).
2. Open DevTools → Console and paste the snippet below. It uses the already-initialized
   Firebase client SDK loaded by the app — no admin credentials needed.

```js
(async () => {
  const { collection, getDocs, doc, updateDoc, deleteField } = await import('firebase/firestore')
  const { db } = await import('/src/lib/firebase.js')
  const groupsSnap = await getDocs(collection(db, 'groups'))
  let touched = 0
  for (const g of groupsSnap.docs) {
    const expSnap = await getDocs(collection(db, 'groups', g.id, 'expenses'))
    for (const e of expSnap.docs) {
      const data = e.data()
      const hasLegacy = typeof data.receiptPath === 'string' && data.receiptPath.length > 0
      const hasNew = Array.isArray(data.receiptPaths) && data.receiptPaths.length > 0
      if (!hasLegacy && data.receiptPath === undefined && hasNew) continue
      const nextPaths = hasNew ? data.receiptPaths : (hasLegacy ? [data.receiptPath] : [])
      await updateDoc(doc(db, 'groups', g.id, 'expenses', e.id), {
        receiptPaths: nextPaths,
        receiptPath: deleteField(),
      })
      touched++
    }
  }
  console.log(`Migrated ${touched} expense documents`)
})()
```

## Verify

- Before: `expenses` docs have `receiptPath: "receipts/..."` field.
- After: docs have `receiptPaths: ["receipts/..."]` and no `receiptPath` field.

## Rollback

Not needed — `normalizeReceiptPaths()` still reads both shapes, so the migration is
idempotent and safe to rerun.
