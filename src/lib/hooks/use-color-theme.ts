'use client'

import { useCallback, useEffect, useState } from 'react'

export type ColorTheme = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal'

const STORAGE_KEY = 'theme-color'

export const COLOR_THEMES: { id: ColorTheme; label: string; color: string }[] = [
  { id: 'green',  label: '翡翠綠', color: 'oklch(0.45 0.15 145)' },
  { id: 'blue',   label: '海洋藍', color: 'oklch(0.5 0.15 250)' },
  { id: 'purple', label: '薰衣紫', color: 'oklch(0.5 0.15 300)' },
  { id: 'orange', label: '暖橙色', color: 'oklch(0.6 0.15 60)' },
  { id: 'pink',   label: '玫瑰粉', color: 'oklch(0.6 0.15 350)' },
  { id: 'teal',   label: '青瓷色', color: 'oklch(0.55 0.12 185)' },
]

function applyColorTheme(color: ColorTheme) {
  const root = document.documentElement
  if (color === 'green') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', color)
  }
}

export function useColorTheme() {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('green')

  // Hydrate from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored: ColorTheme = COLOR_THEMES.some((t) => t.id === raw) ? (raw as ColorTheme) : 'green'
    setColorThemeState(stored)
    applyColorTheme(stored)
  }, [])

  const setColorTheme = useCallback((color: ColorTheme) => {
    setColorThemeState(color)
    localStorage.setItem(STORAGE_KEY, color)
    applyColorTheme(color)
  }, [])

  return { colorTheme, setColorTheme }
}
