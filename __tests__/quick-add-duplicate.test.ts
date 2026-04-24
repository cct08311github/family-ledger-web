import { buildDuplicateHref } from '@/lib/quick-add-duplicate'

describe('buildDuplicateHref', () => {
  it('returns null when id is undefined', () => {
    expect(buildDuplicateHref(undefined)).toBeNull()
  })

  it('returns null when id is null', () => {
    expect(buildDuplicateHref(null)).toBeNull()
  })

  it('returns null when id is empty string', () => {
    expect(buildDuplicateHref('')).toBeNull()
  })

  it('builds href with a normal id', () => {
    expect(buildDuplicateHref('abc123')).toBe('/expense/new?duplicate=abc123')
  })

  it('URL-encodes ids that contain special characters', () => {
    // Firestore ids are URL-safe in practice, but the helper must not break
    // if an id ever contains reserved chars (e.g. from legacy imports).
    expect(buildDuplicateHref('a/b c')).toBe('/expense/new?duplicate=a%2Fb%20c')
  })
})
