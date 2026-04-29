import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminContext } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminLogoutButton from '@/components/admin/AdminLogoutButton'
import NotificationToggles from './NotificationToggles'
import type { AdminNotificationType } from '@/lib/services/adminNotifications'

const VALID_TYPES: AdminNotificationType[] = [
  'story_completed',
  'story_failed',
  'new_user_signed_up',
  'new_guest_story_submitted',
  'new_classroom_created',
  'assignment_completed',
]

const DEFAULT_ON = new Set<AdminNotificationType>(['story_completed', 'story_failed'])

export default async function AdminSettingsPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const db = createAdminClient()
  const { data } = await db
    .from('admin_notification_settings')
    .select('notification_type, enabled')
    .eq('admin_user_id', ctx.userId)

  const saved = new Map(
    (data ?? []).map((r: { notification_type: string; enabled: boolean }) => [r.notification_type, r.enabled])
  )

  const initialSettings = Object.fromEntries(
    VALID_TYPES.map(t => [t, saved.has(t) ? saved.get(t)! : DEFAULT_ON.has(t)])
  )

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/admin" className="font-serif text-base sm:text-lg font-semibold text-white">
            Nest &amp; Quill
          </Link>
          <span className="hidden sm:inline-block text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Stories
          </Link>
          <Link href="/admin/library" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Library
          </Link>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Users
          </Link>
          <Link href="/admin/guests" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Guests
          </Link>
          <Link href="/admin/settings" className="text-xs font-semibold text-white">
            Settings
          </Link>
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Writer →
          </Link>
          <AdminLogoutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your personal admin preferences.</p>
        </div>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Email Notifications</p>
            <p className="text-xs text-gray-600">Choose which system events send you an email. Settings are per-admin.</p>
          </div>
          <NotificationToggles initialSettings={initialSettings} />
        </section>
      </div>
    </div>
  )
}
