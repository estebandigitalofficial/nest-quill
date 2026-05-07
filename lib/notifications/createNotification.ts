// Server-only helper for inserting notifications. Uses the admin
// client so it bypasses RLS — never import from a client component.
//
// Not wired broadly yet. Callers will eventually include:
//   • story-completion path → notify the story owner
//   • classroom assignment created → notify the student
//   • sponsor reward earned → notify the parent/student
//   • admin alerts (audience='admin', user_id=null)
//
// Each insert is one row + the existing pgrst pipeline; safe inside an
// after() hook so the request response isn't blocked.

import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationAudience = 'user' | 'admin' | 'system'

export interface CreateNotificationArgs {
  /** Recipient. Required when audience='user'; null/omitted for admin/system. */
  userId?: string | null
  /** Defaults to 'user'. */
  audience?: NotificationAudience
  /** Short discriminator the UI can branch on (e.g. 'story_complete'). */
  type: string
  title: string
  body?: string | null
  /** Click target; relative or absolute. */
  href?: string | null
  /**
   * When true, skip the insert if a notification already exists with the
   * same (user_id, type, href). Used by hooks that may fire more than
   * once for the same event (poll loops, retried completions). Requires
   * userId + href.
   *
   * Race-tolerant only: two concurrent inserts could both pass the
   * pre-check and create two rows. Acceptable for current volumes.
   */
  dedupe?: boolean
  /**
   * When set, skip the insert if a notification with the same
   * (user_id, type) was created within the last `cooldownMinutes`.
   * Prevents notification floods from a noisy event source. Requires
   * userId. Independent of `dedupe` — both can be combined.
   */
  cooldownMinutes?: number
}

export interface CreateNotificationResult {
  id: string
  /** True when dedupe was set and an existing matching row was returned. */
  deduped?: boolean
}

export async function createNotification(args: CreateNotificationArgs): Promise<CreateNotificationResult> {
  const audience: NotificationAudience = args.audience ?? 'user'
  if (audience === 'user' && !args.userId) {
    throw new Error('createNotification: user audience requires userId')
  }

  const admin = createAdminClient()

  if (args.dedupe && args.userId && args.href) {
    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', args.userId)
      .eq('type', args.type)
      .eq('href', args.href)
      .limit(1)
      .maybeSingle()
    if (existing?.id) return { id: existing.id as string, deduped: true }
  }

  if (args.cooldownMinutes && args.cooldownMinutes > 0 && args.userId) {
    const since = new Date(Date.now() - args.cooldownMinutes * 60_000).toISOString()
    const { data: recent } = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', args.userId)
      .eq('type', args.type)
      .gte('created_at', since)
      .limit(1)
      .maybeSingle()
    if (recent?.id) return { id: recent.id as string, deduped: true }
  }

  const { data, error } = await admin
    .from('notifications')
    .insert({
      user_id: args.userId ?? null,
      audience,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      href: args.href ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`createNotification failed: ${error.message}`)
  return { id: data.id as string }
}
