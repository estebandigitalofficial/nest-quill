'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const TOOLS = [
  { href: '/learning/quiz',        emoji: '🧠', label: 'Quiz Generator' },
  { href: '/learning/flashcards',  emoji: '🃏', label: 'Flashcards' },
  { href: '/learning/explain',     emoji: '💡', label: 'Concept Explainer' },
  { href: '/learning/study-guide', emoji: '📋', label: 'Study Guide' },
  { href: '/learning/math',        emoji: '🔢', label: 'Math Practice' },
  { href: '/learning/spelling',    emoji: '✏️', label: 'Spelling Practice' },
  { href: '/learning/reading',     emoji: '📖', label: 'Reading Comprehension' },
]

export default function LearningDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={ref} className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>

      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-sm text-charcoal-light hover:text-oxford transition-colors"
      >
        Learning
        <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-white rounded-2xl border border-gray-100 shadow-lg py-2 z-50">
          {/* Hub link */}
          <Link href="/learning" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-colors">
            All Learning Tools →
          </Link>
          <div className="h-px bg-gray-100 mx-3 mb-1" />
          {TOOLS.map(t => (
            <Link key={t.href} href={t.href} onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-charcoal hover:bg-indigo-50 hover:text-indigo-700 transition-colors rounded-lg mx-1">
              <span className="text-base w-5 text-center">{t.emoji}</span>
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
