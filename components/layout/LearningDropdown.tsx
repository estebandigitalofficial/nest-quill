import Link from 'next/link'
import { getSetting } from '@/lib/settings/appSettings'

const TOOLS = [
  { href: '/learning/scan-homework', label: 'Scan Homework',        flag: 'scan_homework' },
  { href: '/learning/quiz',          label: 'Quiz Generator',        flag: null },
  { href: '/learning/flashcards',    label: 'Flashcards',            flag: null },
  { href: '/learning/explain',       label: 'Concept Explainer',     flag: null },
  { href: '/learning/study-guide',   label: 'Study Guide',           flag: null },
  { href: '/learning/math',          label: 'Math Practice',         flag: null },
  { href: '/learning/spelling',      label: 'Spelling Practice',     flag: null },
  { href: '/learning/reading',       label: 'Reading Comprehension', flag: null },
]

export default async function LearningDropdown() {
  const scanEnabled = await getSetting('scan_homework_enabled', true)

  const tools = TOOLS.filter(t => t.flag !== 'scan_homework' || scanEnabled)

  return (
    <div className="group relative">

      {/* Trigger */}
      <button className="flex items-center gap-1 text-sm text-charcoal-light hover:text-oxford transition-colors">
        Learning
        <svg className="w-3 h-3 transition-transform duration-150 group-hover:rotate-180"
          fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown panel — starts flush at top-full with pt-2 padding so the
          hover area bridges the visual gap; no gap = no premature close */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 hidden group-hover:block w-52 z-50">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg py-2">
          <Link href="/learning"
            className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-colors">
            All Learning Tools →
          </Link>
          <div className="h-px bg-gray-100 mx-3 mb-1" />
          {tools.map(t => (
            <Link key={t.href} href={t.href}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-charcoal hover:bg-indigo-50 hover:text-indigo-700 transition-colors rounded-lg mx-1">
              {t.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
