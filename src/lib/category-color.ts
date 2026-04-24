/**
 * Deterministic category → accent color mapping (Issue #242).
 *
 * Each category name maps to one of `CATEGORY_PALETTE`, a hand-picked set
 * of 12 OKLCH colours that are visually distinct and avoid the app's
 * destructive/alert reds. Same name → same colour across the whole app.
 *
 * Hash uses a simple FNV-1a variant — we don't need cryptographic strength,
 * just stable distribution across the small palette. Pure function, safe
 * to call in render paths.
 */

export const CATEGORY_PALETTE: readonly string[] = [
  'oklch(92% 0.05 30)',  // peach
  'oklch(92% 0.05 80)',  // butter
  'oklch(92% 0.05 130)', // lime
  'oklch(92% 0.05 160)', // mint
  'oklch(92% 0.05 200)', // sky
  'oklch(92% 0.05 240)', // periwinkle
  'oklch(92% 0.05 280)', // lavender
  'oklch(92% 0.05 310)', // pink
  'oklch(88% 0.06 60)',  // sand
  'oklch(88% 0.06 180)', // aqua
  'oklch(88% 0.06 260)', // iris
  'oklch(88% 0.06 340)', // rose (pale, not destructive)
] as const

export const CATEGORY_FG_PALETTE: readonly string[] = [
  'oklch(35% 0.08 30)',
  'oklch(35% 0.08 80)',
  'oklch(35% 0.08 130)',
  'oklch(35% 0.08 160)',
  'oklch(35% 0.08 200)',
  'oklch(35% 0.08 240)',
  'oklch(35% 0.08 280)',
  'oklch(35% 0.08 310)',
  'oklch(32% 0.10 60)',
  'oklch(32% 0.10 180)',
  'oklch(32% 0.10 260)',
  'oklch(32% 0.10 340)',
] as const

function hashString(s: string): number {
  // FNV-1a 32-bit variant
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Get the index into the palette for a given category name.
 * Normalizes (trim + lowercase) so "餐飲" and "餐飲 " collide.
 */
export function categoryPaletteIndex(name: string | undefined | null): number {
  if (!name) return 0
  const normalized = name.trim().toLowerCase()
  if (!normalized) return 0
  return hashString(normalized) % CATEGORY_PALETTE.length
}

export interface CategoryColorPair {
  bg: string
  fg: string
}

export function categoryColor(name: string | undefined | null): CategoryColorPair {
  const i = categoryPaletteIndex(name)
  return {
    bg: CATEGORY_PALETTE[i],
    fg: CATEGORY_FG_PALETTE[i],
  }
}
