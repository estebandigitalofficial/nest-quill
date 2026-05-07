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
      {/* Page tonal wash — top warmer, bottom cooler. Removes the
          flat-beige feel without adding noise. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-amber-50/30 via-transparent to-blue-100/30" />
      {/* Ambient glow — sun-through-a-window. Bumped opacities so the
          shapes are felt without dominating. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-blue-400/25 blur-3xl" />
        <div className="absolute -top-32 right-[-8rem] w-[32rem] h-[32rem] rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 w-[36rem] h-[36rem] rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      <div className="relative z-10">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-adm-border bg-adm-bg/85 backdrop-blur px-4 sm:px-6 h-14 flex items-center justify-between shadow-sm shadow-amber-900/5">
        <Link href="/admin" className="flex items-center gap-3 group">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={160}
            height={48}
            className="h-9 w-auto"
            priority
          />
          <span className="hidden md:inline text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 group-hover:text-amber-800 transition-colors">
            Command Center
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {betaModeEnabled && (
            <Link
              href="/admin/beta-ops"
              title="Limits are bypassed and some generation may be simulated."
              className="flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-amber-200 transition-colors shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              Beta Mode Active
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

        {/* Left sidebar — navy rail anchors the editorial workspace
            without going near-black. Saturated text + amber accents
            keep the brand voice. */}
        <aside className="hidden sm:block w-52 shrink-0 border-r border-slate-700 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 shadow-xl shadow-slate-900/20">
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
