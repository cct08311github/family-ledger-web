import { splitForHighlight } from '@/lib/highlight-text'

describe('splitForHighlight', () => {
  it('returns empty array for empty text', () => {
    expect(splitForHighlight('', 'foo')).toEqual([])
  })

  it('returns single non-match segment for empty query', () => {
    expect(splitForHighlight('hello world', '')).toEqual([
      { text: 'hello world', isMatch: false },
    ])
  })

  it('returns single non-match segment for whitespace-only query', () => {
    expect(splitForHighlight('hello world', '   ')).toEqual([
      { text: 'hello world', isMatch: false },
    ])
  })

  it('returns single non-match when no matches found', () => {
    expect(splitForHighlight('hello world', 'xyz')).toEqual([
      { text: 'hello world', isMatch: false },
    ])
  })

  it('highlights single match', () => {
    expect(splitForHighlight('hello world', 'world')).toEqual([
      { text: 'hello ', isMatch: false },
      { text: 'world', isMatch: true },
    ])
  })

  it('highlights match at start', () => {
    expect(splitForHighlight('hello world', 'hello')).toEqual([
      { text: 'hello', isMatch: true },
      { text: ' world', isMatch: false },
    ])
  })

  it('highlights match in middle', () => {
    expect(splitForHighlight('hello world', 'lo wo')).toEqual([
      { text: 'hel', isMatch: false },
      { text: 'lo wo', isMatch: true },
      { text: 'rld', isMatch: false },
    ])
  })

  it('highlights multiple matches', () => {
    const r = splitForHighlight('foo bar foo baz foo', 'foo')
    expect(r).toEqual([
      { text: 'foo', isMatch: true },
      { text: ' bar ', isMatch: false },
      { text: 'foo', isMatch: true },
      { text: ' baz ', isMatch: false },
      { text: 'foo', isMatch: true },
    ])
  })

  it('case-insensitive matching preserves original case', () => {
    const r = splitForHighlight('Hello WORLD', 'hello')
    expect(r).toEqual([
      { text: 'Hello', isMatch: true },
      { text: ' WORLD', isMatch: false },
    ])
  })

  it('escapes regex special chars in query', () => {
    // 不應該炸 — query "(test)" 含 regex special
    const r = splitForHighlight('this is (test) example', '(test)')
    expect(r).toEqual([
      { text: 'this is ', isMatch: false },
      { text: '(test)', isMatch: true },
      { text: ' example', isMatch: false },
    ])
  })

  it('handles dot in query as literal dot, not regex any-char', () => {
    const r = splitForHighlight('a.b a-b acb', '.')
    expect(r).toEqual([
      { text: 'a', isMatch: false },
      { text: '.', isMatch: true },
      { text: 'b a-b acb', isMatch: false },
    ])
  })

  it('Chinese characters work correctly', () => {
    const r = splitForHighlight('週三午餐便當', '午餐')
    expect(r).toEqual([
      { text: '週三', isMatch: false },
      { text: '午餐', isMatch: true },
      { text: '便當', isMatch: false },
    ])
  })

  it('trims query whitespace', () => {
    expect(splitForHighlight('hello world', '  world  ')).toEqual([
      { text: 'hello ', isMatch: false },
      { text: 'world', isMatch: true },
    ])
  })

  it('handles consecutive matches without gap', () => {
    const r = splitForHighlight('aaa', 'a')
    expect(r).toEqual([
      { text: 'a', isMatch: true },
      { text: 'a', isMatch: true },
      { text: 'a', isMatch: true },
    ])
  })
})
