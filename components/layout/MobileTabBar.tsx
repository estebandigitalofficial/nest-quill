'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Role-aware destination for the bottom-right Account tab. Logged-out
// users get /login; signed-in users go to their role's home so the tab
// never sends an authenticated user back through the login page.
//   parent   → /account
//   educator → /classroom (auto-redirects to /classroom/educator when
//             they have classes, otherwise lands on the setup page)
//   student  → /classroom/student
//   admin    → routed by their underlying role (typically /account);
//             the admin dashboard remains reachable from the profile menu.
function accountDestination(accountType: string | null | undefined): string {
  if (accountType === 'student')  return '/classroom/student'
  if (accountType === 'educator') return '/classroom'
  return '/account'
}

const TABS = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Create',
    href: '/create',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    label: 'Learning',
    href: '/learning',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: 'Classroom',
    href: '/classroom',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const ACCOUNT_TAB = {
  label: 'Account',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
}

export default function MobileTabBar() {
  const pathname = usePathname()
  // SSR/first-paint default is /login; resolves to the role destination
  // once the supabase session is read on the client. No hydration mismatch
  // because the initial state matches the server-rendered HTML.
  const [accountHref, setAccountHref] = useState<string>('/login')

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const u = data.user
      setAccountHref(u ? accountDestination(u.user_metadata?.account_type as string | undefined) : '/login')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setAccountHref(u ? accountDestination(u.user_metadata?.account_type as string | undefined) : '/login')
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-parchment/95 backdrop-blur border-t border-parchment-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-14">
        {TABS.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-brand-500' : 'text-charcoal-light'
              }`}
            >
              <span className={active ? 'text-brand-500' : 'text-charcoal-light'}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          )
        })}
        {(() => {
          const active = isActive(accountHref)
          return (
            <Link
              key="account"
              href={accountHref}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-brand-500' : 'text-charcoal-light'
              }`}
            >
              <span className={active ? 'text-brand-500' : 'text-charcoal-light'}>
                {ACCOUNT_TAB.icon}
              </span>
              <span className="text-[10px] font-medium tracking-wide">
                {ACCOUNT_TAB.label}
              </span>
            </Link>
          )
        })()}
      </div>
    </nav>
  )
}
