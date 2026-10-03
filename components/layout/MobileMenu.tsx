'use client'

import { useState } from 'react'
import Link from 'next/link'
import { mobileMenuLinks, type LaunchFlags } from '@/lib/launch/scope'
import { useLanguage } from '@/lib/i18n/context'
import { navLabel } from '@/lib/i18n'

export default function MobileMenu({ flags }: { flags: LaunchFlags }) {
  const [open, setOpen] = useState(false)
  const { lang, t } = useLanguage()
  // Launch scope (Phase 2A): same gated set as the desktop header.
  const NAV_LINKS = mobileMenuLinks(flags)
  const close = () => setOpen(false)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? t.nav.menuClose : t.nav.menuOpen}
        aria-expanded={open}
        className="md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10 -mr-1 text-oxford"
      >
        <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 origin-center ${open ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 origin-center ${open ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 md:hidden" onClick={close} />
          {/* Panel — directly below the 58px header */}
          <div className="fixed inset-x-0 top-[58px] z-50 md:hidden bg-parchment border-b border-parchment-dark shadow-lg">
            <nav className="max-w-5xl mx-auto px-6 py-2 flex flex-col">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  className="py-3 text-sm font-medium text-charcoal hover:text-oxford border-b border-parchment-dark last:border-0 transition-colors"
                >
                  {navLabel(lang, href, label)}
                </Link>
              ))}
              <Link href="/contact" onClick={close} className="py-3 text-sm font-medium text-charcoal hover:text-oxford transition-colors">
                {navLabel(lang, '/contact', 'Contact')}
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  )
}
