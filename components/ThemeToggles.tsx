'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'

export function SunIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

export function MoonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export function SystemIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

const THEME_CYCLE = ['light', 'dark', 'system'] as const
type ThemeOption = typeof THEME_CYCLE[number]

export function useToggles() {
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useLanguage()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf((theme as ThemeOption) ?? 'system')
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  const ThemeIcon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : SystemIcon

  return { mounted, lang, setLang, theme, cycleTheme, ThemeIcon }
}
