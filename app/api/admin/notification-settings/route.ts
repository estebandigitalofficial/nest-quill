import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext, adminGuardResponse } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminNotificationType } from '@/lib/services/adminNotifications'

const VALID_TYPES: AdminNotificationType[] = [
  'story_completed',
  'story_failed',
  'new_user_signed_up',
  'new_guest_story_submitted',
  'new_classroom_created',
  'assignment_completed',
]

// GET — return all settings for the current admin (missing rows = use defaults)
export async function GET() {
  const ctx = await getAdminContext()
  if (!ctx) return adminGuardResponse()

  const db = createAdminClient()
  const { data, error } = await db
    .from('admin_notification_settings')
    .select('notification_type, enabled')
    .eq('admin_user_id', ctx.userId)

  if (error) {
    console.error('[admin/notification-settings GET]', error)
    return NextResponse.json({ message: 'Failed to load settings.' }, { status: 500 })
  }

  const saved = new Map(
    (data ?? []).map((r: { notification_type: string; enabled: boolean }) => [r.notification_type, r.enabled])
  )

  // Return a complete map with defaults for missing rows
  const DEFAULT_ON = new Set<AdminNotificationType>(['story_completed', 'story_failed'])
  const settings = Object.fromEntries(
    VALID_TYPES.map(t => [t, saved.has(t) ? saved.get(t) : DEFAULT_ON.has(t)])
  )

  return NextResponse.json({ settings })
}

// PATCH — upsert a single setting
export async function PATCH(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return adminGuardResponse()

  const body = await request.json() as { notification_type?: string; enabled?: boolean }

  if (!body.notification_type || !VALID_TYPES.includes(body.notification_type as AdminNotificationType)) {
    return NextResponse.json({ message: 'Invalid notification_type.' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ message: 'enabled must be a boolean.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db
    .from('admin_notification_settings')
    .upsert(
      {
        admin_user_id: ctx.userId,
        notification_type: body.notification_type,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'admin_user_id,notification_type' }
    )

  if (error) {
    console.error('[admin/notification-settings PATCH]', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      notification_type: body.notification_type,
    })
    // Return DB error details in response — this is an admin-only route so exposure is safe.
    return NextResponse.json(
      {
        message: 'Failed to save setting.',
        error: { code: error.code, message: error.message, details: error.details, hint: error.hint },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
