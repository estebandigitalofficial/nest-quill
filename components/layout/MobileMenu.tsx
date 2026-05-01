'use client'

import { useState } from 'react'
import Link from 'next/link'

const BASE_LINKS = [
  { href: '/create',    label: 'Create a story',  flag: null },
  { href: '/learning',  label: 'Learning',         flag: null },
  { href: '/classroom', label: 'Classroom',        flag: 'classroom' },
  { href: '/pricing',   label: 'Pricing',          flag: null },
]

export default function MobileMenu({ classroomEnabled }: { classroomEnabled: boolean }) {
  const [open, setOpen] = useState(false)
  const NAV_LINKS = BASE_LINKS.filter(l => l.flag !== 'classroom' || classroomEnabled)
  const close = () => setOpen(false)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8 text-oxford"
      >
        <span className={`block h-0.5 bg-current transition-transform duration-200 origin-center ${open ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block h-0.5 bg-current transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block h-0.5 bg-current transition-transform duration-200 origin-center ${open ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={close}
          />
          {/* Panel — fixed directly below the header (h-16 = 64px) */}
          <div className="fixed inset-x-0 top-16 z-50 md:hidden bg-parchment border-b border-parchment-dark shadow-lg">
            <nav className="max-w-5xl mx-auto px-6 py-3 flex flex-col">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="py-2.5 text-sm font-medium text-charcoal hover:text-oxford border-b border-parchment-dark last:border-0 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  )
}
