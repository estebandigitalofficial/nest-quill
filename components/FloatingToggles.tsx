'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

const THEME_CYCLE = ['light', 'dark', 'system'] as const
type ThemeOption = typeof THEME_CYCLE[number]

const btnClass = `
  w-9 h-9 rounded-full flex items-center justify-center
  bg-oxford/10 dark:bg-white/10 backdrop-blur-sm
  border border-oxford/20 dark:border-white/15
  text-oxford dark:text-gray-200
  shadow-sm hover:shadow-md hover:scale-110 transition-all
`.trim()

export default function FloatingToggles() {
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf((theme as ThemeOption) ?? 'system')
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  const ThemeIcon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : SystemIcon

  return (
    <div className="fixed top-[68px] right-3 z-40 flex flex-row gap-1.5">
      {/* Language toggle */}
      <button
        role="switch"
        aria-checked={lang === 'es'}
        onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
        title={lang === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
        className={`${btnClass} text-[11px] font-bold`}
      >
        {lang.toUpperCase()}
      </button>

      {/* Theme toggle — cycles light → dark → system */}
      <button
        onClick={cycleTheme}
        title={`Theme: ${theme} — click to change`}
        className={btnClass}
      >
        <ThemeIcon />
      </button>
    </div>
  )
}
