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

import { buildEmailPayload } from '@/lib/services/email-notification'

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
})
