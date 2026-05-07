import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appUrl } from '@/lib/utils/appUrl'
import { gateSupportIntake } from '@/lib/settings/gates'

const VALID_CATEGORIES = new Set([
  'story_issue', 'account', 'classroom', 'billing',
  'sponsor', 'tour', 'bug', 'other',
])

export async function POST(req: NextRequest) {
  // Beta-ops gate — admin can pause new ticket intake while still seeing
  // the existing inbox at /admin/support.
  const blocked = await gateSupportIntake()
  if (blocked) return blocked

  const body = await req.json().catch(() => null) as
    | { name?: string; email?: string; subject?: string; message?: string; category?: string }
    | null

  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const name    = body.name?.trim()
  const email   = body.email?.trim().toLowerCase()
  const subject = body.subject?.trim()
  const message = body.message?.trim()
  const category = body.category && VALID_CATEGORIES.has(body.category) ? body.category : 'other'

  if (!email || !message) {
    return NextResponse.json({ error: 'Email and message are required.' }, { status: 400 })
  }

  // Identify the submitter without forcing a sign-in.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Source-of-truth insert: a ticket exists even if the email send fails.
  const admin = createAdminClient()
  const { data: ticket, error: ticketErr } = await admin
    .from('support_tickets')
    .insert({
      user_id: user?.id ?? null,
      email,
      name: name ?? null,
      subject: subject || `Contact form: ${category}`,
      message,
      category,
      source: 'contact_form',
    })
    .select('id')
    .single()

  if (ticketErr || !ticket) {
    console.error('[contact] ticket insert failed:', ticketErr)
    return NextResponse.json({ error: 'Could not save your message. Please try again.' }, { status: 500 })
  }

  const ticketId = ticket.id as string
  const refId = ticketId.slice(0, 8)
  const adminLink = appUrl(`/admin/support/${ticketId}`)

  // Best-effort admin email — never blocks the success response.
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Nest & Quill <noreply@nestandquill.com>',
        to: 'contact@nestandquill.com',
        replyTo: email,
        subject: subject ? `[Support ${refId}] ${subject}` : `[Support ${refId}] New ticket`,
        html: `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F5EC;">
            <h2 style="margin:0 0 4px;font-size:20px;color:#0C2340;">New support ticket — #${refId}</h2>
            <p style="margin:0 0 20px;font-size:13px;color:#4a4a4a;">
              Category: <strong>${category}</strong> · ${user ? 'Authenticated' : 'Guest'} · Submitted via /contact
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;width:100px;color:#4a4a4a;font-weight:bold;">Name</td><td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;">${name ?? '—'}</td></tr>
              <tr><td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#4a4a4a;font-weight:bold;">Email</td><td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;">${email}</td></tr>
              <tr><td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#4a4a4a;font-weight:bold;">Subject</td><td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;">${subject || '—'}</td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#fff;border:1px solid #ede9dc;border-radius:8px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#4a4a4a;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
              <p style="margin:0;font-size:14px;color:#2E2E2E;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</p>
            </div>
            <p style="margin:24px 0 0;font-size:13px;">
              <a href="${adminLink}" style="color:#C99700;font-weight:600;">Open ticket in admin →</a>
            </p>
          </div>
        `,
      })
    }
  } catch (err) {
    console.error('[contact] admin email failed (non-fatal):', err)
  }

  // Best-effort admin in-app notification (non-blocking).
  try {
    const { createNotification } = await import('@/lib/notifications/createNotification')
    await createNotification({
      audience: 'admin',
      userId: null,
      type: 'support_ticket',
      title: `New support ticket — #${refId}`,
      body: `${category} · ${email}`,
      href: `/admin/support/${ticketId}`,
    })
  } catch (err) {
    console.error('[contact] admin notification failed (non-fatal):', err)
  }

  return NextResponse.json({ ok: true, ticketId, refId })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
