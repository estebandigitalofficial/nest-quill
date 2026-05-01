import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getAdminContext } from '@/lib/admin/guard'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import AdminNavLinks from '@/components/admin/AdminNavLinks'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800">
        {/* Main row */}
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/admin" className="flex items-center">
              <Image
                src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
                alt="Nest & Quill"
                width={160}
                height={48}
                className="h-8 w-auto brightness-0 invert"
                priority
              />
            </Link>
            <span className="hidden sm:inline-block text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden sm:flex items-center gap-6 overflow-x-auto">
              <AdminNavLinks />
            </div>
            <AdminLogoutButton />
          </div>
        </div>

        {/* Toggles — no bar, just the pills */}
        <div className="pb-1.5 px-4 sm:px-6 flex items-center justify-end gap-2">
          <LanguageToggle variant="admin" />
          <ThemeToggle variant="admin" />
        </div>
      </header>

      <div className="pb-16 sm:pb-0">
        {children}
      </div>

      <AdminBottomNav />
    </div>
  )
}
