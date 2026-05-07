'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasUnread, type Notification } from '@/lib/notifications/types'

type Menu = 'notifications' | 'help' | 'settings' | null

interface UserSummary {
  email: string | null
  accountType: string
}

export default function UserControls() {
  const [user, setUser] = useState<UserSummary | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifError, setNotifError] = useState<string | null>(null)
  const [open, setOpen] = useState<Menu>(null)
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Self-fetching keeps SiteHeader cookie-free so it can be imported from both
  // server and client pages. Renders nothing for logged-out users.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const u = data.user
      setUser(u
        ? { email: u.email ?? null, accountType: (u.user_metadata?.account_type as string | undefined) ?? 'parent' }
        : null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u
        ? { email: u.email ?? null, accountType: (u.user_metadata?.account_type as string | undefined) ?? 'parent' }
        : null)
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  // Admin status comes from the server (profiles.is_admin OR an env-allowlisted
  // email). Cheap one-shot fetch; the route does its own auth-context check.
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    let cancelled = false
    fetch('/api/auth/is-admin', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((data) => { if (!cancelled) setIsAdmin(!!data.isAdmin) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
    return () => { cancelled = true }
  }, [user])

  // Notifications: fetch once after sign-in, refetch when the bell opens
  // so a freshly-arrived notification (e.g. story complete) shows up
  // without a page reload. No realtime/polling.
  useEffect(() => {
    if (!user) { setNotifications([]); setNotifError(null); return }
    let cancelled = false
    setNotifError(null)
    fetch('/api/notifications', { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ notifications: Notification[]; unreadCount: number }>
      })
      .then((data) => { if (!cancelled) setNotifications(data.notifications) })
      .catch(() => { if (!cancelled) setNotifError("Couldn't load notifications.") })
    return () => { cancelled = true }
  }, [user, open === 'notifications'])

  // Click-outside + Escape close the open menu so the dropdowns behave like a
  // single mutually-exclusive control cluster.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(menu: Menu) {
    setOpen(prev => (prev === menu ? null : menu))
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(null)
    router.push('/')
    router.refresh()
  }

  // Optimistically flip the row to read locally and fire-and-forget the
  // PATCH. A failed PATCH leaves the optimistic state — the next fetch
  // will reconcile if needed. Idempotent server-side.
  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n))
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'same-origin',
      })
    } catch { /* swallow — local state already updated */ }
  }

  // Don't render for logged-out users (or while we don't yet know the state).
  if (!user) return null

  const { email, accountType } = user
  const isStudent = accountType === 'student'
  const isEducator = accountType === 'educator'
  const showClassroomLink = isStudent || isEducator
  const showArchivedLink = !isStudent && !isEducator // archives only exist for parent accounts
  const unread = hasUnread(notifications)

  return (
    <div ref={wrapperRef} className="flex items-center gap-1 relative">
      <IconButton label={unread ? 'Notifications (unread)' : 'Notifications'} active={open === 'notifications'} onClick={() => toggle('notifications')}>
        <BellIcon />
        {unread && (
          <span aria-hidden className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-parchment" />
        )}
      </IconButton>
      <IconButton label="Help" active={open === 'help'} onClick={() => toggle('help')}>
        <HelpIcon />
      </IconButton>
      <IconButton label="Account menu" active={open === 'settings'} onClick={() => toggle('settings')}>
        <UserIcon />
      </IconButton>

      {open === 'notifications' && (
        <Dropdown title="Notifications">
          {notifError ? (
            <p className="px-4 py-6 text-sm text-red-500 text-center">{notifError}</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-charcoal-light text-center">No notifications yet.</p>
          ) : (
            <ul role="list" className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => { if (n.unread) markRead(n.id); setOpen(null) }}
                      className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      <NotificationRow n={n} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={!n.unread}
                      onClick={() => markRead(n.id)}
                      className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors disabled:cursor-default">
                      <NotificationRow n={n} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Dropdown>
      )}

      {open === 'help' && (
        <Dropdown title="Help & support">
          <DropdownLink href="/contact" onClick={() => setOpen(null)}>Contact support</DropdownLink>
          <DropdownLink href="/pricing" onClick={() => setOpen(null)}>Plans &amp; pricing</DropdownLink>
          <DropdownLink href="/privacy" onClick={() => setOpen(null)}>Privacy</DropdownLink>
          <DropdownLink href="/terms" onClick={() => setOpen(null)}>Terms</DropdownLink>
        </Dropdown>
      )}

      {open === 'settings' && (
        <Dropdown title={email ?? 'Account'}>
          {showClassroomLink ? (
            <DropdownLink href={isEducator ? '/classroom/educator' : '/classroom/student'} onClick={() => setOpen(null)}>
              {isEducator ? 'My classes' : 'My dashboard'}
            </DropdownLink>
          ) : (
            <>
              <DropdownLink href="/account" onClick={() => setOpen(null)}>My stories</DropdownLink>
              {showArchivedLink && (
                <DropdownLink href="/account/archived" onClick={() => setOpen(null)}>Archived stories</DropdownLink>
              )}
            </>
          )}
          {isAdmin && (
            <DropdownLink href="/admin" onClick={() => setOpen(null)}>Admin dashboard</DropdownLink>
          )}
          <div className="border-t border-gray-100 my-1" />
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
            Sign out
          </button>
        </Dropdown>
      )}
    </div>
  )
}

function NotificationRow({ n }: { n: Notification }) {
  return (
    <div className="flex items-start gap-2.5">
      {n.unread && <span aria-hidden className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${n.unread ? 'font-semibold text-charcoal' : 'text-charcoal-light'}`}>{n.title}</p>
        {n.body && <p className="text-xs text-charcoal-light mt-0.5 line-clamp-2">{n.body}</p>}
      </div>
    </div>
  )
}

function IconButton({
  label, active, onClick, children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={active}
      className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
        active ? 'bg-oxford/10 text-oxford' : 'text-charcoal-light hover:text-oxford hover:bg-oxford/5'
      }`}
    >
      {children}
    </button>
  )
}

function Dropdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden z-50">
      <p className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 truncate">
        {title}
      </p>
      <div className="py-1">{children}</div>
    </div>
  )
}

function DropdownLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="block px-4 py-2 text-sm text-charcoal hover:bg-gray-50 hover:text-oxford transition-colors">
      {children}
    </Link>
  )
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
