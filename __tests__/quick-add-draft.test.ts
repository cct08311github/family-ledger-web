import {
  buildDraftKey,
  serializeDraft,
  parseDraft,
  DRAFT_MAX_AGE_MS,
  type QuickAddDraft,
} from '@/lib/quick-add-draft'

describe('buildDraftKey', () => {
  it('produces per-user per-group key', () => {
    expect(buildDraftKey('G1', 'u1')).toBe('quick-add-draft:G1:u1')
  })

  it('returns null when groupId missing', () => {
    expect(buildDraftKey(null, 'u1')).toBeNull()
    expect(buildDraftKey(undefined, 'u1')).toBeNull()
    expect(buildDraftKey('', 'u1')).toBeNull()
  })

  it('returns null when uid missing', () => {
    expect(buildDraftKey('G1', null)).toBeNull()
    expect(buildDraftKey('G1', undefined)).toBeNull()
    expect(buildDraftKey('G1', '')).toBeNull()
  })

  it('escapes separators in ids to avoid key collision', () => {
    // (group "a-b" + uid "c") used to collide with (group "a" + uid "b-c")
    // under the old `${id}-${uid}` format. Encoded form has no collision.
    const a = buildDraftKey('a-b', 'c')
    const b = buildDraftKey('a', 'b-c')
    expect(a).not.toBe(b)
    const colon = buildDraftKey('a:b', 'c')
    const colon2 = buildDraftKey('a', 'b:c')
    expect(colon).not.toBe(colon2)
  })
})

describe('serializeDraft / parseDraft roundtrip', () => {
  const now = 1_713_398_400_000 // deterministic

  it('roundtrips a full draft', () => {
    const input: QuickAddDraft = {
      description: '午餐',
      amount: '150',
      category: '餐飲',
      savedAt: now,
    }
    const raw = serializeDraft(input)
    const parsed = parseDraft(raw, now)
    expect(parsed).toEqual(input)
  })

  it('roundtrips when category is empty (content still meaningful)', () => {
    const input: QuickAddDraft = {
      description: 'x',
      amount: '1',
      category: '',
      savedAt: now,
    }
    const parsed = parseDraft(serializeDraft(input), now)
    expect(parsed).toEqual(input)
  })

  it('parseDraft returns null on corrupt JSON', () => {
    expect(parseDraft('not-json', now)).toBeNull()
    expect(parseDraft('{bad}', now)).toBeNull()
  })

  it('parseDraft returns null on missing savedAt', () => {
    const raw = JSON.stringify({ description: 'x', amount: '1', category: 'a' })
    expect(parseDraft(raw, now)).toBeNull()
  })

  it('parseDraft drops drafts older than DRAFT_MAX_AGE_MS', () => {
    const old = serializeDraft({
      description: 'x',
      amount: '1',
      category: '',
      savedAt: now - DRAFT_MAX_AGE_MS - 1,
    })
    expect(parseDraft(old, now)).toBeNull()
  })

  it('parseDraft accepts drafts at exactly the TTL boundary', () => {
    const boundary = serializeDraft({
      description: 'x',
      amount: '1',
      category: '',
      savedAt: now - DRAFT_MAX_AGE_MS,
    })
    expect(parseDraft(boundary, now)).not.toBeNull()
  })

  it('parseDraft coerces non-string fields to safe defaults', () => {
    // description is a valid non-empty string so the draft survives
    // requireContent; coercion only hits amount/category.
    const raw = JSON.stringify({
      description: '午餐',
      amount: null,
      category: { evil: true },
      savedAt: now,
    })
    const parsed = parseDraft(raw, now)
    expect(parsed).toEqual({ description: '午餐', amount: '', category: '', savedAt: now })
  })

  it('parseDraft drops non-string description under requireContent', () => {
    const raw = JSON.stringify({
      description: 42,
      amount: '',
      category: '',
      savedAt: now,
    })
    expect(parseDraft(raw, now)).toBeNull()
  })

  it('parseDraft returns null when empty after coercion (no meaningful content)', () => {
    const raw = JSON.stringify({
      description: '',
      amount: '',
      category: '',
      savedAt: now,
    })
    expect(parseDraft(raw, now, { requireContent: true })).toBeNull()
  })

  it('requireContent=false retains empty drafts', () => {
    const raw = JSON.stringify({ description: '', amount: '', category: '', savedAt: now })
    expect(parseDraft(raw, now, { requireContent: false })).not.toBeNull()
  })
})
