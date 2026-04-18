import { getNotificationHref } from '@/lib/notification-navigation'

function n(type: string, entityId?: string | null) {
  return { type, entityId: entityId ?? null } as { type: string; entityId: string | null }
}

describe('getNotificationHref', () => {
  describe('expense events', () => {
    it('expense_added with entityId → /expense/:id (edit page)', () => {
      expect(getNotificationHref(n('expense_added', 'e1'))).toBe('/expense/e1')
    })

    it('expense_updated with entityId → /expense/:id', () => {
      expect(getNotificationHref(n('expense_updated', 'e2'))).toBe('/expense/e2')
    })

    it('expense_added without entityId → /records (fallback, no id to open)', () => {
      expect(getNotificationHref(n('expense_added', null))).toBe('/records')
    })

    it('expense_deleted → /settings/activity-log (entity gone, see audit trail)', () => {
      // Even with entityId we cannot open /expense/:id because it will 404;
      // route to the activity log where the deletion is recorded.
      expect(getNotificationHref(n('expense_deleted', 'e3'))).toBe('/settings/activity-log')
      expect(getNotificationHref(n('expense_deleted', null))).toBe('/settings/activity-log')
    })
  })

  describe('settlement events', () => {
    it('settlement_created → /split', () => {
      expect(getNotificationHref(n('settlement_created', 's1'))).toBe('/split')
    })

    it('settlement_deleted → /split', () => {
      expect(getNotificationHref(n('settlement_deleted', 's2'))).toBe('/split')
    })

    it('settlement events ignore entityId (splits page shows all)', () => {
      expect(getNotificationHref(n('settlement_created', null))).toBe('/split')
    })
  })

  describe('member events', () => {
    it('member_added → /settings', () => {
      expect(getNotificationHref(n('member_added'))).toBe('/settings')
    })

    it('member_removed → /settings', () => {
      expect(getNotificationHref(n('member_removed'))).toBe('/settings')
    })

    it('member_updated → /settings', () => {
      expect(getNotificationHref(n('member_updated'))).toBe('/settings')
    })
  })

  describe('miscellaneous', () => {
    it('unknown type → null (no navigation)', () => {
      expect(getNotificationHref(n('reminder'))).toBeNull()
      expect(getNotificationHref(n('future_unknown_type'))).toBeNull()
    })

    it('empty type → null', () => {
      expect(getNotificationHref(n(''))).toBeNull()
    })
  })

  describe('path safety', () => {
    it('encodes entityId segment to avoid path injection', () => {
      // An attacker cannot inject ?query=… or #hash via entityId because
      // encodeURIComponent escapes reserved chars.
      const href = getNotificationHref(n('expense_added', 'weird/id?x=1'))
      expect(href).toBe('/expense/weird%2Fid%3Fx%3D1')
    })
  })
})
