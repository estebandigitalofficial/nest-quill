'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()
  const close = () => setOpen(false)

  const NAV_LINKS = [
    { href: '/create',    label: t.nav.create },
    { href: '/learning',  label: t.nav.learning },
    { href: '/classroom', label: t.nav.classroom },
    { href: '/pricing',   label: t.nav.pricing },
  ]

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
          <div className="fixed inset-0 z-40 md:hidden" onClick={close} />
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
