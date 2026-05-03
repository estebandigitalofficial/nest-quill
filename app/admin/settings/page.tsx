import { getAdminContext } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import SettingsHub from './SettingsHub'
import type { AdminNotificationType } from '@/lib/services/adminNotifications'
import type { StripeEnv } from './StripeStatusPanel'

// Secret values stay on the server; only booleans + the public flag are
// passed to the client component.
function readStripeEnv(): StripeEnv {
  const secret = process.env.STRIPE_SECRET_KEY ?? ''
  const detectedMode: StripeEnv['detectedMode'] =
    secret.startsWith('sk_test_') ? 'test'
    : secret.startsWith('sk_live_') ? 'live'
    : null
  return {
    hasSecretKey: secret.length > 0,
    hasWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? '').length > 0,
    hasPublishableKey: (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').length > 0,
    paymentsEnabledFlag: process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true',
    detectedMode,
  }
}

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-adm-text">Settings</h1>
        <p className="text-sm text-adm-muted mt-1">Manage admin preferences and configure product behavior.</p>
      </div>
      <SettingsHub initialSettings={initialSettings} stripeEnv={readStripeEnv()} />
    </div>
  )
}
