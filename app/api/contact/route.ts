import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appUrl } from '@/lib/utils/appUrl'
import { gateSupportIntake } from '@/lib/settings/gates'
import { checkSupportRateLimit, hashIp } from '@/lib/limits/rateLimits'
import { getAdminContext } from '@/lib/admin/guard'

// Stable slug set. Mirrors components/admin (read-only display) and
// app/contact/ContactForm (the dropdown). When a client posts something
// outside this set, we accept the request but coerce to 'other' so
// the ticket is still created — the client may have an older bundle.
// To return a hard 400 instead, set REJECT_UNKNOWN_CATEGORY = true.
const VALID_CATEGORIES = new Set([
  'story_issue',
  'account_login',
  'classroom_educator',
  'billing_pricing',
  'sponsor_rewards',
  'guided_tour_confusion',
  'bug_report',
  'other',
])
// Backwards-compat: shorter slugs from the prior ContactForm bundle.
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  account:    'account_login',
  classroom:  'classroom_educator',
  billing:    'billing_pricing',
  sponsor:    'sponsor_rewards',
  tour:       'guided_tour_confusion',
  bug:        'bug_report',
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (err) {
    console.error('[contact] unhandled error in POST:', err)
    return NextResponse.json(
      { error: 'We could not process your message. Please try again.', code: 'CONTACT_INTERNAL' },
      { status: 500 },
    )
  }
}

async function handlePost(req: NextRequest) {
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
  // Resolve category: accept current slugs as-is, map known legacy
  // shorter slugs forward, fall through to 'other' for anything else.
  const rawCat = body.category?.trim()
  const category = rawCat && VALID_CATEGORIES.has(rawCat)
    ? rawCat
    : (rawCat && LEGACY_CATEGORY_MAP[rawCat]) ?? 'other'

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  // Identify the submitter without forcing a sign-in.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Beta abuse protection: per-identifier daily rate limit. Admins bypass.
  const adminCtx = user ? await getAdminContext() : null
  const ipRawForHash = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ipHash = await hashIp(ipRawForHash)
  const rate = await checkSupportRateLimit({
    userId: user?.id ?? null,
    email,
    ipHash,
    isAdmin: !!adminCtx,
  })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.message, code: rate.code, retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429 },
    )
  }

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
