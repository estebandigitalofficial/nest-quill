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
    <div className="relative min-h-screen bg-adm-bg text-adm-text overflow-x-hidden">
      {/* Ambient glow layers — fixed so they don't scroll, pointer-
          events-none so they can't intercept clicks. The whole admin
          inherits a warmer feel without flipping the dark base. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        {/* Cobalt + amber + soft cyan — operations-room atmosphere on
            top of the warm-dark base. Saturation is intentionally low
            to stay editorial, not Tron. */}
        <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-blue-700/12 blur-3xl" />
        <div className="absolute -top-32 right-[-8rem] w-[32rem] h-[32rem] rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 w-[36rem] h-[36rem] rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
      </div>

      <div className="relative z-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-adm-bg/80 backdrop-blur px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-3 group">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={160}
            height={48}
            className="h-9 w-auto brightness-0 invert"
            priority
          />
          <span className="hidden md:inline text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70 group-hover:text-amber-200 transition-colors">
            Command Center
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {betaModeEnabled && (
            <Link
              href="/admin/beta-ops"
              title="Limits are bypassed and some generation may be simulated."
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-amber-500/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              Beta Mode Active
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-4 border-r border-white/10 pr-4">
            <AdminHeaderToggles />
          </div>
          <AdminLogoutButton />
        </div>
      </header>

      {/* ── Body: sidebar + content ─────────────────────────────── */}
      <div className="flex">

        {/* Left sidebar — desktop only */}
        <aside className="hidden sm:block w-52 shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
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
    </div>
  )
}
