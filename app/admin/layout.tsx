import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminContext } from '@/lib/admin/guard'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import AdminNavLinks from '@/components/admin/AdminNavLinks'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/admin" className="font-serif text-base sm:text-lg font-semibold text-white">
            Nest &amp; Quill
          </Link>
          <span className="hidden sm:inline-block text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto">
          <AdminNavLinks />
          <AdminLogoutButton />
        </div>
      </header>
      {children}
    </div>
  )
}
