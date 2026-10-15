'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeaderToggles from '@/components/admin/AdminHeaderToggles'

// Phone-only entry to the full admin navigation. Below `sm` the sidebar is
// hidden and the bottom tab bar only carries the five essentials, which
// left Story Images, Guests, Email Drips, Beta Readiness, Story Prompts and
// Beta Mode unreachable on a phone. This button opens the existing sidebar
// in a drawer (same groups, same links, same component) and also exposes
// the language/theme toggles the header hides below `sm`. Nothing here
// changes which routes exist or who may open them.

export default function AdminMobileMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on navigation and on Escape.
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin navigation"
        aria-expanded={open}
        aria-controls="admin-mobile-menu"
        className="flex items-center justify-center w-10 h-10 -mr-1 rounded-md text-adm-muted hover:text-adm-text transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Admin navigation" id="admin-mobile-menu">
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          {/* Panel: never wider than the phone, scrolls internally. */}
          <div className="absolute inset-y-0 right-0 w-[min(18rem,85vw)] bg-adm-bg border-l border-adm-border shadow-2xl flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-adm-border shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-adm-subtle">Admin menu</span>
              <div className="flex items-center gap-3">
                <AdminHeaderToggles />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex items-center justify-center w-9 h-9 rounded-md text-adm-muted hover:text-adm-text transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <AdminSidebar />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
