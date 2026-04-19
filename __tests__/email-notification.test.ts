jest.mock('@/lib/firebase', () => ({ db: {}, auth: {}, storage: {} }))
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { buildEmailPayload, formatEmailDate, buildDeepLinkUrl, isValidEntityId } from '@/lib/services/email-notification'
import type { EmailDetails } from '@/lib/services/email-notification'

describe('buildEmailPayload', () => {
  it('prefixes subject with group name when provided', () => {
    const p = buildEmailPayload({ title: '新增共同支出', body: 'anything', groupName: '家裡' })
    expect(p.subject).toBe('【家裡】 新增共同支出')
  })

  it('falls back to 家計本 when no group name', () => {
    const p = buildEmailPayload({ title: '新增結算', body: 'x' })
    expect(p.subject).toBe('【家計本】 新增結算')
  })

  it('body text contains the notification body', () => {
    const p = buildEmailPayload({ title: 't', body: '阿爸新增了午餐 (NT$150)' })
    expect(p.text).toContain('阿爸新增了午餐 (NT$150)')
  })

  it('body text includes app link and unsubscribe hint', () => {
    const p = buildEmailPayload({ title: 't', body: 'b' })
    expect(p.text).toContain('前往查看')
    expect(p.text).toMatch(/Email 通知/)
  })

  // --- Issue #187 HIGH fixes: SMTP header injection guards ---

  it('strips CRLF from title to prevent SMTP header injection', () => {
    // The real exploit is injecting CRLF so the SMTP server treats the rest as
    // a new header (e.g., Bcc:). After sanitization, "Bcc:" may still appear
    // as plain subject text but has no structural effect without the CRLF
    // delimiter. The security property we verify is: subject contains no CRLF.
    const p = buildEmailPayload({
      title: '新增支出\r\nBcc: attacker@evil.com',
      body: 'b',
    })
    expect(p.subject).not.toMatch(/[\r\n]/)
  })

  it('strips CRLF from groupName (also flows into header via the tag prefix)', () => {
    const p = buildEmailPayload({
      title: 't',
      body: 'b',
      groupName: '家裡\r\nX-Injected: yes',
    })
    expect(p.subject).not.toMatch(/[\r\n]/)
  })

  it('multiple consecutive CRLFs collapse to a single space (no hidden blanks)', () => {
    const p = buildEmailPayload({ title: 'A\r\n\r\n\r\nB', body: 'b' })
    expect(p.subject).not.toMatch(/[\r\n]/)
    // A and B should be separated by exactly one space, not preserved as gap
    expect(p.subject).toContain('A B')
  })

  it('allows CRLF in body text (body is not a header)', () => {
    const p = buildEmailPayload({ title: 't', body: 'line1\nline2\nline3' })
    expect(p.text).toContain('line1\nline2\nline3')
  })

  it('empty title still produces a valid subject', () => {
    const p = buildEmailPayload({ title: '', body: 'b' })
    expect(p.subject).toBe('【家計本】 ')
    expect(p.subject.length).toBeGreaterThan(0)
  })

  it('extremely long body still builds (caller should size-check before write)', () => {
    const huge = 'x'.repeat(10000)
    const p = buildEmailPayload({ title: 't', body: huge })
    expect(p.text).toContain(huge)
  })

  it('subject has no leading/trailing whitespace around the tag-title separator', () => {
    const p = buildEmailPayload({ title: 'Hi', body: 'b', groupName: 'G' })
    // Format: 【G】 Hi (one space between bracket and title)
    expect(p.subject).toMatch(/^【G】 Hi$/)
  })

  // --- Issue #213: structured details in body ---

  describe('with details — expense (shared with splits)', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 300,
      isShared: true,
      payerName: '爸爸',
      splits: [
        { name: '爸爸', share: 150 },
        { name: '媽媽', share: 150 },
      ],
      note: '家庭聚餐',
    }

    it('body contains 項目', () => {
      const p = buildEmailPayload({ title: 't', body: '爸爸新增了 午餐（NT$ 300）', details })
      expect(p.text).toContain('項目：午餐')
    })

    it('body contains 金額 with NT$ prefix', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('NT$')
      expect(p.text).toContain('300')
    })

    it('body contains 日期 in YYYY-MM-DD format', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('日期：2026-04-19')
    })

    it('body contains 付款人', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('付款人：爸爸')
    })

    it('body contains split member lines', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('爸爸')
      expect(p.text).toContain('媽媽')
      expect(p.text).toContain('分攤（2 人）')
    })

    it('body contains 備註', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('備註：家庭聚餐')
    })

    it('one-liner lead line is still present', () => {
      const p = buildEmailPayload({ title: 't', body: '爸爸新增了 午餐（NT$ 300）', details })
      expect(p.text).toContain('爸爸新增了 午餐（NT$ 300）')
    })

    it('body is NOT sanitized of newlines (plain text)', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      // Multi-line body must contain actual newlines
      expect(p.text).toContain('\n')
    })

    it('amount uses toLocaleString format (1000 separator)', () => {
      const bigDetails: EmailDetails = { ...details, amount: 1000 }
      const p = buildEmailPayload({ title: 't', body: 'b', details: bigDetails })
      // 1000 formatted with toLocaleString — in most envs this produces "1,000"
      // but at minimum it should render "1000" or "1,000". Check NT$ + digits.
      expect(p.text).toMatch(/NT\$\s*[\d,]+/)
    })
  })

  describe('with details — expense personal (not shared)', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '個人咖啡',
      amount: 80,
      isShared: false,
    }

    it('body contains 分攤：個人支出（不分攤）', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('分攤：個人支出（不分攤）')
    })

    it('body does not show 付款人 when not provided', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).not.toContain('付款人：')
    })

    it('body does not show 備註 when not provided', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).not.toContain('備註：')
    })
  })

  describe('with details — expense shared but splits empty', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '飲料',
      amount: 50,
      isShared: true,
      splits: [],
    }

    it('body contains 分攤：（無）', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('分攤：（無）')
    })
  })

  describe('with details — settlement', () => {
    const details: EmailDetails = {
      kind: 'settlement',
      date: new Date('2026-04-15T00:00:00Z'),
      fromName: '媽媽',
      toName: '爸爸',
      amount: 500,
    }

    it('body contains 日期', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('日期：2026-04-15')
    })

    it('body contains 金額', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('500')
    })

    it('body contains from → to', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('媽媽 → 爸爸')
    })

    it('footer link still present', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      // Settlement deep link → /split; footer now uses "前往結算" label.
      expect(p.text).toMatch(/前往結算|前往查看|前往首頁/)
    })
  })

  describe('with details — settlement_batch with 5 items', () => {
    const details: EmailDetails = {
      kind: 'settlement_batch',
      count: 5,
      items: [
        { fromName: 'A', toName: 'B', amount: 100 },
        { fromName: 'C', toName: 'D', amount: 200 },
        { fromName: 'E', toName: 'F', amount: 300 },
        { fromName: 'G', toName: 'H', amount: 400 },
        { fromName: 'I', toName: 'J', amount: 500 },
      ],
    }

    it('body contains 共 5 筆', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('共 5 筆')
    })

    it('body contains top 3 items', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('A → B')
      expect(p.text).toContain('C → D')
      expect(p.text).toContain('E → F')
    })

    it('body contains ellipsis for items beyond top 3', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).toContain('…')
    })

    it('body does NOT contain 4th or 5th items', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).not.toContain('G → H')
      expect(p.text).not.toContain('I → J')
    })
  })

  describe('with details — settlement_batch exactly 3 items (no ellipsis)', () => {
    const details: EmailDetails = {
      kind: 'settlement_batch',
      count: 3,
      items: [
        { fromName: 'A', toName: 'B', amount: 100 },
        { fromName: 'C', toName: 'D', amount: 200 },
        { fromName: 'E', toName: 'F', amount: 300 },
      ],
    }

    it('body does NOT contain ellipsis when count equals items shown', () => {
      const p = buildEmailPayload({ title: 't', body: 'b', details })
      expect(p.text).not.toContain('…')
    })
  })

  describe('no details — backward compat', () => {
    it('produces old one-liner format without details section', () => {
      const p = buildEmailPayload({ title: 't', body: '爸爸新增了午餐（NT$ 150）' })
      expect(p.text).toBe(
        '爸爸新增了午餐（NT$ 150）\n\n—\n前往查看：' +
          (process.env.NEXT_PUBLIC_APP_URL || 'https://family-ledger-web.local/') +
          '\n若不想再收到此類郵件，請到 設定 → 🔔 Email 通知 關閉開關。',
      )
    })

    it('does not contain 項目 or 日期 when no details', () => {
      const p = buildEmailPayload({ title: 't', body: 'b' })
      expect(p.text).not.toContain('項目：')
      expect(p.text).not.toContain('日期：')
    })
  })

  describe('sanitizeHeader still applied to title (regression)', () => {
    it('title with injected CRLF still produces clean subject when details present', () => {
      const details: EmailDetails = {
        kind: 'expense',
        date: new Date('2026-04-19'),
        description: '測試',
        amount: 100,
        isShared: true,
      }
      const p = buildEmailPayload({
        title: '惡意\r\nBcc: attacker@evil.com',
        body: 'b',
        details,
      })
      expect(p.subject).not.toMatch(/[\r\n]/)
    })
  })
})

describe('formatEmailDate', () => {
  it('formats a native Date as YYYY-MM-DD', () => {
    expect(formatEmailDate(new Date('2026-04-19T12:00:00Z'))).toBe('2026-04-19')
  })

  it('formats a Firestore Timestamp-like object (with toDate())', () => {
    const ts = { toDate: () => new Date('2026-01-05T00:00:00Z') }
    expect(formatEmailDate(ts)).toBe('2026-01-05')
  })

  it('pads month and day with leading zeros', () => {
    expect(formatEmailDate(new Date('2026-03-07T00:00:00Z'))).toBe('2026-03-07')
  })

  // --- New tests for reviewer feedback (Issue #214) ---

  it('returns empty string when toDate() throws', () => {
    const bad = { toDate: () => { throw new Error('boom') } }
    expect(formatEmailDate(bad)).toBe('')
  })

  it('returns empty string for null', () => {
    expect(formatEmailDate(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatEmailDate(undefined)).toBe('')
  })

  it('returns deterministic YYYY-MM-DD in Asia/Taipei regardless of server TZ', () => {
    // 2026-04-18T20:00:00Z = 2026-04-19T04:00:00+08:00 → should be 2026-04-19
    expect(formatEmailDate(new Date('2026-04-18T20:00:00Z'))).toBe('2026-04-19')
  })
})

describe('buildEmailPayload — reviewer feedback fixes (Issue #214)', () => {
  it('settlement_batch with 10 items: builder slices to top 3 + ellipsis (caller passes all 10)', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      fromName: `From${i}`,
      toName: `To${i}`,
      amount: (i + 1) * 100,
    }))
    const details: EmailDetails = {
      kind: 'settlement_batch',
      count: 10,
      items,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('From0 → To0')
    expect(p.text).toContain('From1 → To1')
    expect(p.text).toContain('From2 → To2')
    expect(p.text).not.toContain('From3 → To3')
    expect(p.text).toContain('…')
  })

  it('truncates description longer than 500 chars with ellipsis', () => {
    const longDesc = 'a'.repeat(501)
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: longDesc,
      amount: 100,
      isShared: false,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('…')
    // The truncated description should be exactly 500 chars + '…'
    expect(p.text).toContain('項目：' + 'a'.repeat(500) + '…')
  })

  it('truncates note longer than 500 chars with ellipsis', () => {
    const longNote = 'n'.repeat(502)
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 100,
      isShared: false,
      note: longNote,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('備註：' + 'n'.repeat(500) + '…')
  })

  it('truncates splits name longer than 500 chars with ellipsis', () => {
    const longName = 'x'.repeat(600)
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 200,
      isShared: true,
      splits: [{ name: longName, share: 200 }],
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('x'.repeat(500) + '…')
  })

  it('fmtAmount produces thousand separators for 1,234,567', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '大額支出',
      amount: 1234567,
      isShared: false,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    // zh-TW locale should produce "1,234,567"
    expect(p.text).toContain('1,234,567')
  })
})

// --- Issue #215: category + deep link ---

describe('buildEmailPayload — category (Issue #215)', () => {
  it('body contains 類別：餐飲 when category is provided', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: true,
      category: '餐飲',
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('類別：餐飲')
  })

  it('body does NOT contain 類別： when category is absent', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: true,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).not.toContain('類別：')
  })

  it('category longer than 500 chars is truncated with ellipsis', () => {
    const longCategory = 'c'.repeat(501)
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: false,
      category: longCategory,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('類別：' + 'c'.repeat(500) + '…')
  })
})

describe('buildEmailPayload — deep link footer (Issue #215)', () => {
  it('footer contains /expense/:id deep link when entityId is provided', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: true,
      entityId: 'abc123',
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('/expense/abc123')
    expect(p.text).toContain('查看此筆')
  })

  it('footer routes to /settings/activity-log when deleted: true', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: true,
      entityId: 'abc123',
      deleted: true,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('/settings/activity-log')
    expect(p.text).not.toContain('/expense/abc123')
  })

  it('settlement footer shows /split link', () => {
    const details: EmailDetails = {
      kind: 'settlement',
      date: new Date('2026-04-15T00:00:00Z'),
      fromName: '媽媽',
      toName: '爸爸',
      amount: 500,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('/split')
  })

  it('settlement_batch footer shows /split link', () => {
    const details: EmailDetails = {
      kind: 'settlement_batch',
      count: 3,
      items: [{ fromName: 'A', toName: 'B', amount: 100 }],
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('/split')
  })

  it('no details → no deep link, only generic 前往查看 line (backward compat)', () => {
    const p = buildEmailPayload({ title: 't', body: 'b' })
    expect(p.text).toContain('前往查看：')
    expect(p.text).not.toContain('查看此筆：')
  })
})

describe('buildDeepLinkUrl (Issue #215)', () => {
  it('strips trailing slash from base URL to avoid double-slash', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date(),
      description: 'x',
      amount: 1,
      isShared: false,
      entityId: 'e1',
    }
    const url = buildDeepLinkUrl(details, 'https://app.example.com/')
    expect(url).toBe('https://app.example.com/expense/e1')
    // Path segment should not contain a double-slash after the protocol //
    expect(url?.replace('https://', '')).not.toContain('//')
  })

  it('rejects entityId with special chars (spaces/&/=) — falls back to /records (isValidEntityId guard)', () => {
    // isValidEntityId allows only [A-Za-z0-9_-]{1,64}. An id with spaces and
    // special chars is rejected to prevent oversized or malformed URLs. The
    // caller would need Firestore write access to inject such an id anyway.
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date(),
      description: 'x',
      amount: 1,
      isShared: false,
      entityId: 'id with spaces & special=chars',
    }
    const url = buildDeepLinkUrl(details, 'https://app.example.com')
    expect(url).toBe('https://app.example.com/records')
  })

  it('returns null when details is undefined', () => {
    expect(buildDeepLinkUrl(undefined, 'https://app.example.com')).toBeNull()
  })
})

// --- Issue #217: reviewer feedback ---

describe('buildDeepLinkUrl — reviewer feedback (Issue #217)', () => {
  const base = 'https://app.example.com'

  it('empty string entityId falls back to /records (not null)', () => {
    // Aligns with getNotificationHref: expense_added/updated without entityId → /records
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date(),
      description: 'x',
      amount: 1,
      isShared: false,
      entityId: '',
    }
    expect(buildDeepLinkUrl(details, base)).toBe(`${base}/records`)
  })

  it('whitespace-only entityId falls back to /records', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date(),
      description: 'x',
      amount: 1,
      isShared: false,
      entityId: '   ',
    }
    expect(buildDeepLinkUrl(details, base)).toBe(`${base}/records`)
  })

  it('oversized entityId (70 chars) is rejected → falls back to /records', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date(),
      description: 'x',
      amount: 1,
      isShared: false,
      entityId: 'a'.repeat(70),
    }
    // isValidEntityId rejects ids longer than 64 chars
    expect(buildDeepLinkUrl(details, base)).toBe(`${base}/records`)
  })

  it('entityId with slash (a/b) is rejected → falls back to /records', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date(),
      description: 'x',
      amount: 1,
      isShared: false,
      entityId: 'a/b',
    }
    expect(buildDeepLinkUrl(details, base)).toBe(`${base}/records`)
  })
})

describe('buildEmailPayload footer labels — reviewer feedback (Issue #217)', () => {
  it('settlement footer contains "前往結算" (not "查看此筆")', () => {
    const details: EmailDetails = {
      kind: 'settlement',
      date: new Date('2026-04-15T00:00:00Z'),
      fromName: '媽媽',
      toName: '爸爸',
      amount: 500,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('前往結算：')
    expect(p.text).not.toContain('查看此筆：')
  })

  it('expense with deleted:true footer contains "查看紀錄" (not "查看此筆")', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: true,
      entityId: 'abc123',
      deleted: true,
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('查看紀錄：')
    expect(p.text).not.toContain('查看此筆：')
  })

  it('expense without entityId footer deep link is /records (align with getNotificationHref)', () => {
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 150,
      isShared: true,
      // no entityId
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('/records')
  })
})

describe('isValidEntityId (Issue #217)', () => {
  it('accepts a normal Firestore auto-id (alphanumeric + hyphens)', () => {
    expect(isValidEntityId('abc123-XYZ_456')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidEntityId('')).toBe(false)
  })

  it('rejects an id longer than 64 chars', () => {
    expect(isValidEntityId('a'.repeat(65))).toBe(false)
  })

  it('accepts an id of exactly 64 chars', () => {
    expect(isValidEntityId('a'.repeat(64))).toBe(true)
  })

  it('rejects an id containing a slash', () => {
    expect(isValidEntityId('a/b')).toBe(false)
  })

  it('rejects an id containing a space', () => {
    expect(isValidEntityId('a b')).toBe(false)
  })
})

// --- Issue #216: expense edit diff rendering ---

describe('buildEmailPayload — expense changes diff (Issue #216)', () => {
  const baseDetails: EmailDetails = {
    kind: 'expense',
    date: new Date('2026-04-19T00:00:00Z'),
    description: '午餐',
    amount: 200,
    isShared: true,
  }

  it('body contains 變更： heading when changes are present', () => {
    const details: EmailDetails = {
      ...baseDetails,
      changes: [{ label: '金額', from: 'NT$ 100', to: 'NT$ 200' }],
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('變更：')
  })

  it('body contains each change entry in - label：from → to format', () => {
    const details: EmailDetails = {
      ...baseDetails,
      changes: [
        { label: '金額', from: 'NT$ 100', to: 'NT$ 200' },
        { label: '描述', from: '早餐', to: '早午餐' },
        { label: '類別', from: '餐飲', to: '外食' },
      ],
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('  - 金額：NT$ 100 → NT$ 200')
    expect(p.text).toContain('  - 描述：早餐 → 早午餐')
    expect(p.text).toContain('  - 類別：餐飲 → 外食')
  })

  it('body does NOT contain 變更： when changes is empty array', () => {
    const details: EmailDetails = { ...baseDetails, changes: [] }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).not.toContain('變更：')
  })

  it('body does NOT contain 變更： when changes is undefined', () => {
    const details: EmailDetails = { ...baseDetails, changes: undefined }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).not.toContain('變更：')
  })

  it('long from/to values are truncated with …', () => {
    const longFrom = 'f'.repeat(501)
    const longTo = 't'.repeat(502)
    const details: EmailDetails = {
      ...baseDetails,
      changes: [{ label: '描述', from: longFrom, to: longTo }],
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('f'.repeat(500) + '…')
    expect(p.text).toContain('t'.repeat(500) + '…')
  })

  it('backward compat: expense without changes still renders normal body (regression from #214/#217)', () => {
    // No changes field at all — should render exactly like pre-#216
    const details: EmailDetails = {
      kind: 'expense',
      date: new Date('2026-04-19T00:00:00Z'),
      description: '午餐',
      amount: 300,
      isShared: true,
      payerName: '爸爸',
      splits: [
        { name: '爸爸', share: 150 },
        { name: '媽媽', share: 150 },
      ],
      note: '家庭聚餐',
    }
    const p = buildEmailPayload({ title: 't', body: 'b', details })
    expect(p.text).toContain('項目：午餐')
    expect(p.text).toContain('金額：')
    expect(p.text).toContain('分攤（2 人）')
    expect(p.text).toContain('備註：家庭聚餐')
    expect(p.text).not.toContain('變更：')
  })
})
