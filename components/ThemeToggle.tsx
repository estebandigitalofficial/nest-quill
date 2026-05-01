'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const SystemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)

const OPTIONS = ['light', 'dark', 'system'] as const

export default function ThemeToggle({ variant = 'site' }: { variant?: 'site' | 'admin' }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-24 h-8" />

  const isAdmin = variant === 'admin'

  return (
    <div className={`flex items-center rounded-full p-0.5 gap-0.5 ${
      isAdmin
        ? 'bg-gray-800 border border-gray-700'
        : 'bg-parchment-dark dark:bg-gray-800 border border-charcoal/10 dark:border-gray-700'
    }`}>
      {OPTIONS.map(opt => {
        const active = theme === opt
        return (
          <button
            key={opt}
            onClick={() => setTheme(opt)}
            title={opt.charAt(0).toUpperCase() + opt.slice(1)}
            className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
              active
                ? isAdmin
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-oxford text-parchment shadow-sm dark:bg-brand-500 dark:text-white'
                : isAdmin
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-charcoal-light hover:text-charcoal dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {opt === 'light'  && <SunIcon />}
            {opt === 'dark'   && <MoonIcon />}
            {opt === 'system' && <SystemIcon />}
          </button>
        )
      })}
    </div>
  )
}
