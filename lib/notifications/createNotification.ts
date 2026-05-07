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
}

export async function createNotification(args: CreateNotificationArgs): Promise<{ id: string }> {
  const audience: NotificationAudience = args.audience ?? 'user'
  if (audience === 'user' && !args.userId) {
    throw new Error('createNotification: user audience requires userId')
  }

  const admin = createAdminClient()
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
