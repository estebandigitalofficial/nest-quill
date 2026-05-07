import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appUrl } from '@/lib/utils/appUrl'
import { gateSupportIntake } from '@/lib/settings/gates'
import { checkSupportRateLimit, hashIp } from '@/lib/limits/rateLimits'
import { getAdminContext } from '@/lib/admin/guard'

// Stable slug set. Mirrors components/admin (read-only display) and
// app/contact/ContactForm (the dropdown).
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

// Per-stage diagnostic codes returned to the client. Keep messages
// user-safe; the code lets the operator (and the front-end if it
// chooses to display it) trace the failing line in seconds.
const CODE = {
  GATE:       'CONTACT_GATE_FAILED',
  PARSE:      'CONTACT_PARSE_FAILED',
  VALIDATION: 'CONTACT_VALIDATION_FAILED',
  AUTH:       'CONTACT_AUTH_FAILED',
  RATELIMIT:  'CONTACT_RATE_LIMIT_FAILED',
  INSERT:     'CONTACT_INSERT_FAILED',
  INTERNAL:   'CONTACT_INTERNAL',
} as const

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const out = await handlePost(req)
    console.info('[contact] returning success', { ms: Date.now() - t0 })
    return out
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[contact] unhandled error in POST:', message, err instanceof Error ? err.stack : null)
    return NextResponse.json(
      { error: 'We could not process your message. Please try again.', code: CODE.INTERNAL, debug: message.slice(0, 200) },
      { status: 500 },
    )
  }
}

async function handlePost(req: NextRequest) {
  // ── Stage 1: gate ───────────────────────────────────────────────────
  console.info('[contact] gate start')
  const blocked = await gateSupportIntake()
  if (blocked) {
    console.info('[contact] gate result: blocked')
    return blocked
  }
  console.info('[contact] gate result: allowed')

  // ── Stage 2: body parse ─────────────────────────────────────────────
  const body = await req.json().catch((err) => {
    console.error('[contact] body parse failed:', err instanceof Error ? err.message : err)
    return null
  }) as
    | { name?: string; email?: string; subject?: string; message?: string; category?: string }
    | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.', code: CODE.PARSE }, { status: 400 })
  }
  console.info('[contact] body parsed', {
    hasEmail:   !!body.email,
    hasMessage: !!body.message,
    category:   body.category ?? null,
  })

  // ── Stage 3: validation ─────────────────────────────────────────────
  const name    = body.name?.trim()
  const email   = body.email?.trim().toLowerCase()
  const subject = body.subject?.trim()
  const message = body.message?.trim()
  const rawCat = body.category?.trim()
  const category = rawCat && VALID_CATEGORIES.has(rawCat)
    ? rawCat
    : (rawCat && LEGACY_CATEGORY_MAP[rawCat]) ?? 'other'

  if (!email) {
    console.info('[contact] validation result: missing email')
    return NextResponse.json({ error: 'Email is required.', code: CODE.VALIDATION }, { status: 400 })
  }
  if (!message) {
    console.info('[contact] validation result: missing message')
    return NextResponse.json({ error: 'Message is required.', code: CODE.VALIDATION }, { status: 400 })
  }
  console.info('[contact] validation result: ok', { category })

  // ── Stage 4: identify user (best-effort) ────────────────────────────
  let user: { id: string } | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user ?? null
    console.info('[contact] auth result:', user ? `user ${user.id.slice(0, 8)}…` : 'guest')
  } catch (err) {
    // Auth failure should NOT block a guest submit — log and proceed.
    console.error('[contact] auth lookup failed (non-fatal):', err instanceof Error ? err.message : err)
    user = null
  }

  // ── Stage 5: rate limit (best-effort) ───────────────────────────────
  let rateBlock = false
  let rateMessage: string | undefined
  let rateRetryAfter: number | undefined
  try {
    const adminCtx = user ? await getAdminContext().catch(() => null) : null
    const ipRawForHash = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const ipHash = await hashIp(ipRawForHash).catch(() => null)
    const rate = await checkSupportRateLimit({
      userId: user?.id ?? null,
      email,
      ipHash,
      isAdmin: !!adminCtx,
    })
    if (!rate.allowed) {
      rateBlock = true
      rateMessage = rate.message
      rateRetryAfter = rate.retryAfterSeconds
    }
    console.info('[contact] rate limit result:', rate.allowed ? 'allowed' : `blocked (${rate.code})`)
  } catch (err) {
    // Rate-limit logging should never fail the user — log and proceed.
    console.error('[contact] rate limit check failed (non-fatal):', err instanceof Error ? err.message : err)
  }
  if (rateBlock) {
    return NextResponse.json(
      { error: rateMessage, code: CODE.RATELIMIT, retryAfterSeconds: rateRetryAfter },
      { status: 429 },
    )
  }

  // ── Stage 6: insert ticket (source of truth) ────────────────────────
  console.info('[contact] inserting ticket', { hasUser: !!user, category })
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
    // Surface every available detail in the server log so the next
    // failure isn't a guessing game. Pass `code` from PostgREST through
    // to the response — it identifies relation/permission/check issues
    // in seconds (42P01 missing table, 23514 check violation, etc.).
    console.error('[contact] insert failed', {
      message: ticketErr?.message,
      code: ticketErr?.code,
      details: ticketErr?.details,
      hint: ticketErr?.hint,
    })
    return NextResponse.json(
      {
        error: 'Could not save your message. Please try again.',
        code: CODE.INSERT,
        debug: ticketErr?.code ? `${ticketErr.code}: ${ticketErr.message}` : (ticketErr?.message ?? 'unknown'),
      },
      { status: 500 },
    )
  }

  const ticketId = ticket.id as string
  const refId = ticketId.slice(0, 8)
  console.info('[contact] insert success', { refId, ticketId })
  const adminLink = appUrl(`/admin/support/${ticketId}`)

  // ── Stage 7: best-effort admin email ────────────────────────────────
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
    console.error('[contact] admin email failed (non-fatal):', err instanceof Error ? err.message : err)
  }

  // ── Stage 8: best-effort admin notification ─────────────────────────
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
    console.error('[contact] admin notification failed (non-fatal):', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ ok: true, ticketId, refId })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
