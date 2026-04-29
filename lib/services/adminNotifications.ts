import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = 'Nest & Quill by Bright Tale Books <stories@nestandquill.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestandquill.com'

export type AdminNotificationType =
  | 'story_completed'
  | 'story_failed'
  | 'new_user_signed_up'
  | 'new_guest_story_submitted'
  | 'new_classroom_created'
  | 'assignment_completed'

// These are ON by default when no settings row exists for an admin
const DEFAULT_ON = new Set<AdminNotificationType>(['story_completed', 'story_failed'])

// email_type values used in delivery_logs for dedup (story events only)
const DELIVERY_LOG_TYPE: Partial<Record<AdminNotificationType, string>> = {
  story_completed: 'admin_story_completed',
  story_failed: 'admin_story_failed',
}

export async function getEnabledAdminEmails(type: AdminNotificationType): Promise<string[]> {
  const db = createAdminClient()

  const { data: adminProfiles } = await db
    .from('profiles')
    .select('id, email')
    .eq('is_admin', true)

  if (!adminProfiles?.length) return []

  const adminIds = adminProfiles.map((p: { id: string }) => p.id)
  const { data: settings } = await db
    .from('admin_notification_settings')
    .select('admin_user_id, enabled')
    .eq('notification_type', type)
    .in('admin_user_id', adminIds)

  const settingsMap = new Map(
    (settings ?? []).map((s: { admin_user_id: string; enabled: boolean }) => [s.admin_user_id, s.enabled])
  )
  const defaultEnabled = DEFAULT_ON.has(type)

  const emails: string[] = []
  for (const p of adminProfiles as { id: string; email: string }[]) {
    const setting = settingsMap.get(p.id)
    const enabled = setting !== undefined ? setting : defaultEnabled
    if (enabled && p.email) emails.push(p.email)
  }
  return emails
}

// Core sender — checks dedup via delivery_logs for story events, sends to all enabled admins
export async function sendAdminNotification(
  type: AdminNotificationType,
  subject: string,
  html: string,
  opts?: { requestId?: string }
): Promise<void> {
  const db = createAdminClient()
  const emailType = opts?.requestId ? DELIVERY_LOG_TYPE[type] : undefined

  // Dedup: if we already sent an admin notification for this request, skip
  if (opts?.requestId && emailType) {
    const { count } = await db
      .from('delivery_logs')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', opts.requestId)
      .eq('channel', 'email')
      .eq('email_type', emailType)
      .in('status', ['sent', 'delivered'])
    if ((count ?? 0) > 0) return
  }

  const emails = await getEnabledAdminEmails(type)
  if (!emails.length) return

  const resend = getResend()
  const results = await Promise.allSettled(
    emails.map(to =>
      resend.emails.send({ from: FROM, to, subject, html })
    )
  )

  // Log one delivery entry for story events (for dedup)
  if (opts?.requestId && emailType) {
    const anySuccess = results.some(r => r.status === 'fulfilled' && !(r.value as { error?: unknown }).error)
    await db.from('delivery_logs').insert({
      request_id: opts.requestId,
      channel: 'email',
      status: anySuccess ? 'sent' : 'failed',
      recipient_email: emails.join(','),
      email_type: emailType,
    }).then(() => {})
  }

  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length) {
    console.error('[adminNotifications] some sends failed', type, failures.length)
  }
}

// ── Email templates ──────────────────────────────────────────────────────────

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0C2340;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0C2340;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:20px;text-align:center;">
<p style="margin:0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#fff;">Nest &amp; Quill — Admin</p>
</td></tr>
<tr><td style="background:#1a2e4a;border-radius:12px;border:1px solid #2a3f5f;padding:28px 28px;">
${body}
</td></tr>
<tr><td style="padding-top:16px;text-align:center;">
<a href="${APP_URL}/admin" style="font-size:12px;color:#64748b;text-decoration:none;">Open Admin Dashboard →</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;font-size:12px;color:#94a3b8;">${label}</td><td style="padding:4px 0 4px 16px;font-size:12px;color:#e2e8f0;text-align:right;">${value}</td></tr>`
}

export function buildStoryCompletedEmail(data: {
  requestId: string; childName: string; storyTitle: string; planTier: string; userEmail?: string
}): { subject: string; html: string } {
  const subject = `✓ Story complete — ${data.childName}'s "${data.storyTitle}"`
  const html = shell(`
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#34d399;">✓ Story Complete</p>
<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${new Date().toUTCString()}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${row('Child', data.childName)}
${row('Title', data.storyTitle)}
${row('Plan', data.planTier)}
${data.userEmail ? row('User', data.userEmail) : ''}
${row('Request ID', data.requestId.slice(0, 8) + '…')}
</table>
<a href="${APP_URL}/story/${data.requestId}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">View Story →</a>
`)
  return { subject, html }
}

export function buildStoryFailedEmail(data: {
  requestId: string; childName: string; storyTheme: string; planTier: string; userEmail?: string; lastError?: string
}): { subject: string; html: string } {
  const subject = `✗ Story failed — ${data.childName} (${data.storyTheme})`
  const html = shell(`
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#f87171;">✗ Story Failed</p>
<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${new Date().toUTCString()}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${row('Child', data.childName)}
${row('Theme', data.storyTheme)}
${row('Plan', data.planTier)}
${data.userEmail ? row('User', data.userEmail) : ''}
${row('Request ID', data.requestId.slice(0, 8) + '…')}
${data.lastError ? row('Error', `<span style="color:#fca5a5;word-break:break-all;">${data.lastError}</span>`) : ''}
</table>
<a href="${APP_URL}/admin?q=${encodeURIComponent(data.requestId)}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">View in Admin →</a>
`)
  return { subject, html }
}

export function buildNewUserEmail(data: {
  email: string; accountType: string
}): { subject: string; html: string } {
  const subject = `New user signed up — ${data.email}`
  const html = shell(`
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#818cf8;">🙋 New User Signed Up</p>
<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${new Date().toUTCString()}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${row('Email', data.email)}
${row('Account type', data.accountType)}
</table>
<a href="${APP_URL}/admin/users?q=${encodeURIComponent(data.email)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">View User →</a>
`)
  return { subject, html }
}

export function buildGuestStoryEmail(data: {
  requestId: string; childName: string; storyTheme: string; userEmail?: string
}): { subject: string; html: string } {
  const subject = `Guest story submitted — ${data.childName} (${data.storyTheme})`
  const html = shell(`
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#fbbf24;">📖 Guest Story Submitted</p>
<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${new Date().toUTCString()}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${row('Child', data.childName)}
${row('Theme', data.storyTheme)}
${data.userEmail ? row('Guest email', data.userEmail) : ''}
${row('Request ID', data.requestId.slice(0, 8) + '…')}
</table>
<a href="${APP_URL}/admin" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">View Admin →</a>
`)
  return { subject, html }
}

export function buildNewClassroomEmail(data: {
  classroomId: string; name: string; educatorEmail: string; grade?: number | null; subject?: string | null
}): { subject: string; html: string } {
  const subject = `New classroom created — ${data.name}`
  const html = shell(`
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#2dd4bf;">🏫 New Classroom Created</p>
<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${new Date().toUTCString()}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${row('Classroom', data.name)}
${row('Educator', data.educatorEmail)}
${data.grade ? row('Grade', String(data.grade)) : ''}
${data.subject ? row('Subject', data.subject) : ''}
</table>
<a href="${APP_URL}/admin/users?q=${encodeURIComponent(data.educatorEmail)}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">View Educator →</a>
`)
  return { subject, html }
}

export function buildAssignmentCompletedEmail(data: {
  assignmentTitle: string; classroomName: string; studentId: string; score?: number | null; total?: number | null
}): { subject: string; html: string } {
  const scoreStr = data.score != null && data.total != null ? `${data.score}/${data.total}` : '—'
  const subject = `Assignment completed — ${data.assignmentTitle}`
  const html = shell(`
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#a78bfa;">🏆 Assignment Completed</p>
<p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${new Date().toUTCString()}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
${row('Assignment', data.assignmentTitle)}
${row('Classroom', data.classroomName)}
${row('Score', scoreStr)}
${row('Student ID', data.studentId.slice(0, 8) + '…')}
</table>
<a href="${APP_URL}/admin" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">View Admin →</a>
`)
  return { subject, html }
}
