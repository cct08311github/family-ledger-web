export interface HighlightSegment {
  text: string
  isMatch: boolean
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split text into segments alternating non-match / match for highlighting.
 * Case-insensitive substring match. Returns a single non-match segment when
 * either input is empty or no matches found, so the caller can render
 * uniformly.
 */
export function splitForHighlight(
  text: string,
  query: string,
): HighlightSegment[] {
  if (!text) return []
  const trimmedQuery = (query ?? '').trim()
  if (!trimmedQuery) return [{ text, isMatch: false }]

  const escaped = escapeRegExp(trimmedQuery)
  const re = new RegExp(escaped, 'gi')
  const segments: HighlightSegment[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null = re.exec(text)

  while (m !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, m.index), isMatch: false })
    }
    segments.push({ text: m[0], isMatch: true })
    lastIndex = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
    m = re.exec(text)
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isMatch: false })
  }

  return segments.length === 0 ? [{ text, isMatch: false }] : segments
}
