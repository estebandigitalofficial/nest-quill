import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getAdminContext } from '@/lib/admin/guard'
import { getSetting } from '@/lib/settings/appSettings'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import AdminHeaderToggles from '@/components/admin/AdminHeaderToggles'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const betaModeEnabled = await getSetting('beta_mode_enabled', false)

  return (
    <div className="min-h-screen bg-adm-bg text-adm-text">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-adm-border bg-adm-bg px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/admin" className="flex items-center">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={160}
            height={48}
            className="h-11 w-auto brightness-0 invert"
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          {betaModeEnabled && (
            <Link
              href="/admin/beta"
              title="Limits are bypassed and some generation may be simulated."
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-amber-500/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              Beta Mode Active
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-4 border-r border-gray-800 pr-4">
            <AdminHeaderToggles />
          </div>
          <AdminLogoutButton />
        </div>
      </header>

      {/* ── Body: sidebar + content ─────────────────────────────── */}
      <div className="flex">

        {/* Left sidebar — desktop only */}
        <aside className="hidden sm:block w-48 shrink-0 border-r border-adm-border">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
            <AdminSidebar />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-16 sm:pb-0">
          {children}
        </main>

      </div>

      {/* Mobile bottom nav */}
      <AdminBottomNav />

    </div>
  )
}
