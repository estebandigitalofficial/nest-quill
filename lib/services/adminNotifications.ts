import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/utils/appUrl'
import { renderEmail, eyebrow, heading, paragraph, button, detailsTable, messageBlock, escapeHtml } from '@/lib/email/layout'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = 'Nest & Quill <stories@nestandquill.com>'
const APP_URL = getAppUrl()

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
// Internal notifications use the same branded layout as customer emails, with
// the "Admin notification" label. Every interpolated value is escaped: child
// names, titles and emails come from customer input.

type Tone = 'accent' | 'success' | 'danger' | 'muted'

function adminEmail(opts: {
  subject: string
  label: string
  tone: Tone
  title: string
  rows: Array<[string, string | null | undefined | false]>
  cta: { label: string; url: string }
}): string {
  const rows = opts.rows
    .filter((r): r is [string, string] => typeof r[1] === 'string' && r[1] !== '')
    .map(([label, value]) => [label, escapeHtml(value)] as [string, string])
  return renderEmail({
    appUrl: APP_URL,
    audience: 'internal',
    title: opts.subject,
    body: [
      eyebrow(opts.label, opts.tone),
      heading(escapeHtml(opts.title)),
      paragraph(new Date().toUTCString(), { small: true, muted: true }),
      detailsTable(rows),
      button(opts.cta.label, opts.cta.url),
    ].join('\n'),
  })
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…'
}

export function buildStoryCompletedEmail(data: {
  requestId: string; childName: string; storyTitle: string; planTier: string; userEmail?: string
}): { subject: string; html: string } {
  const subject = `✓ Story complete — ${data.childName}'s "${data.storyTitle}"`
  const html = adminEmail({
    subject,
    label: '✓ Story complete',
    tone: 'success',
    title: `${data.childName}'s "${data.storyTitle}"`,
    rows: [
      ['Child', data.childName],
      ['Title', data.storyTitle],
      ['Plan', data.planTier],
      ['User', data.userEmail],
      ['Request ID', shortId(data.requestId)],
    ],
    cta: { label: 'View story →', url: `${APP_URL}/story/${data.requestId}` },
  })
  return { subject, html }
}

export function buildStoryFailedEmail(data: {
  requestId: string; childName: string; storyTheme: string; planTier: string; userEmail?: string; lastError?: string
}): { subject: string; html: string } {
  const subject = `✗ Story failed — ${data.childName} (${data.storyTheme})`
  const html = adminEmail({
    subject,
    label: '✗ Story failed',
    tone: 'danger',
    title: `${data.childName} (${data.storyTheme})`,
    rows: [
      ['Child', data.childName],
      ['Theme', data.storyTheme],
      ['Plan', data.planTier],
      ['User', data.userEmail],
      ['Request ID', shortId(data.requestId)],
      ['Error', data.lastError],
    ],
    cta: { label: 'View in admin →', url: `${APP_URL}/admin?q=${encodeURIComponent(data.requestId)}` },
  })
  return { subject, html }
}

export function buildNewUserEmail(data: {
  email: string; accountType: string
}): { subject: string; html: string } {
  const subject = `New user signed up — ${data.email}`
  const html = adminEmail({
    subject,
    label: '🙋 New user',
    tone: 'accent',
    title: data.email,
    rows: [
      ['Email', data.email],
      ['Account type', data.accountType],
    ],
    cta: { label: 'View user →', url: `${APP_URL}/admin/users?q=${encodeURIComponent(data.email)}` },
  })
  return { subject, html }
}

export function buildGuestStoryEmail(data: {
  requestId: string; childName: string; storyTheme: string; userEmail?: string
}): { subject: string; html: string } {
  const subject = `Guest story submitted — ${data.childName} (${data.storyTheme})`
  const html = adminEmail({
    subject,
    label: '📖 Guest story submitted',
    tone: 'accent',
    title: `${data.childName} (${data.storyTheme})`,
    rows: [
      ['Child', data.childName],
      ['Theme', data.storyTheme],
      ['Guest email', data.userEmail],
      ['Request ID', shortId(data.requestId)],
    ],
    cta: { label: 'View admin →', url: `${APP_URL}/admin` },
  })
  return { subject, html }
}

export function buildNewClassroomEmail(data: {
  classroomId: string; name: string; educatorEmail: string; grade?: number | null; subject?: string | null
}): { subject: string; html: string } {
  const subject = `New classroom created — ${data.name}`
  const html = adminEmail({
    subject,
    label: '🏫 New classroom',
    tone: 'accent',
    title: data.name,
    rows: [
      ['Classroom', data.name],
      ['Educator', data.educatorEmail],
      ['Grade', data.grade ? String(data.grade) : null],
      ['Subject', data.subject],
    ],
    cta: { label: 'View educator →', url: `${APP_URL}/admin/users?q=${encodeURIComponent(data.educatorEmail)}` },
  })
  return { subject, html }
}

export function buildAssignmentCompletedEmail(data: {
  assignmentTitle: string; classroomName: string; studentId: string; score?: number | null; total?: number | null
}): { subject: string; html: string } {
  const scoreStr = data.score != null && data.total != null ? `${data.score}/${data.total}` : '—'
  const subject = `Assignment completed — ${data.assignmentTitle}`
  const html = adminEmail({
    subject,
    label: '🏆 Assignment completed',
    tone: 'accent',
    title: data.assignmentTitle,
    rows: [
      ['Assignment', data.assignmentTitle],
      ['Classroom', data.classroomName],
      ['Score', scoreStr],
      ['Student ID', shortId(data.studentId)],
    ],
    cta: { label: 'View admin →', url: `${APP_URL}/admin` },
  })
  return { subject, html }
}

// ── Support ticket (contact form) ────────────────────────────────────────────
// Sent to contact@ by app/api/contact/route.ts, reply-to the submitter.

export function buildSupportTicketEmail(data: {
  refId: string; category: string; authenticated: boolean; name?: string | null; email: string; subject?: string | null; message: string; adminLink: string
}): string {
  return renderEmail({
    appUrl: APP_URL,
    audience: 'internal',
    title: `New support ticket #${data.refId}`,
    body: [
      eyebrow('✉️ Support ticket', 'accent'),
      heading(`New support ticket — #${escapeHtml(data.refId)}`),
      paragraph(`${escapeHtml(data.category)} · ${data.authenticated ? 'Authenticated' : 'Guest'} · Submitted via /contact`, { small: true, muted: true }),
      detailsTable([
        ['Name', escapeHtml(data.name || '—')],
        ['Email', `<a href="mailto:${escapeHtml(data.email)}" style="color:#0f2140;">${escapeHtml(data.email)}</a>`],
        ['Subject', escapeHtml(data.subject || '—')],
      ]),
      eyebrow('Message', 'muted'),
      messageBlock(data.message),
      button('Open ticket in admin →', data.adminLink),
      paragraph('Reply to this email to answer the customer directly.', { small: true, muted: true }),
    ].join('\n'),
  })
}
