import { getAdminContext } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
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
  if (!ctx) return null

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
  )
}
