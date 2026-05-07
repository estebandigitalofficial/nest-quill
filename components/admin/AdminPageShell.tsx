// Consistent container for admin pages. Most pages already wrap their
// content in `max-w-6xl mx-auto px-6 py-8 space-y-8` — this exists so
// new pages can opt in with one component, and so future spacing
// adjustments live in one place.
//
// This is opt-in. Existing pages still hand-roll their containers and
// continue to work.

import type { ReactNode } from 'react'

export default function AdminPageShell({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 ${className}`}>
      {children}
    </div>
  )
}
