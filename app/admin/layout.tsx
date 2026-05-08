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
      {/* Header height steps up at sm so the larger desktop logo
          (h-12, exactly matches the source's intrinsic 48px height —
          no upscaling, no blur) sits in a roomy 64px bar. Mobile
          keeps the compact 56px bar with the original 36px logo so
          screen real estate is preserved. */}
      <header className="sticky top-0 z-50 border-b border-adm-border bg-adm-bg px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-3 group">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={160}
            height={48}
            className="h-9 sm:h-12 w-auto brightness-0 invert"
            priority
          />
          <span className="hidden md:inline text-[11px] font-semibold uppercase tracking-[0.18em] text-adm-subtle group-hover:text-adm-text transition-colors">
            Command Center
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {betaModeEnabled && (
            <Link
              href="/admin/beta-ops"
              title="Limits are bypassed and some generation may be simulated."
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium px-2.5 py-1 rounded-md hover:bg-amber-500/15 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              Beta Mode
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-4 border-r border-adm-border pr-4">
            <AdminHeaderToggles />
          </div>
          <AdminLogoutButton />
        </div>
      </header>

      {/* ── Body: sidebar + content ─────────────────────────────── */}
      <div className="flex">

        {/* Left sidebar — flat dark rail. Linear/Vercel style. */}
        <aside className="hidden sm:block w-52 shrink-0 border-r border-adm-border bg-adm-bg">
          {/* Sidebar is sm+ only, where the header is h-16 (4rem). */}
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <AdminSidebar />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 sm:pb-0">
          {children}
        </main>

      </div>

      {/* Mobile bottom nav */}
      <AdminBottomNav />

    </div>
  )
}
