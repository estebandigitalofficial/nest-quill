import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json()

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'Nest & Quill <noreply@nestandquill.com>',
      to: 'contact@nestandquill.com',
      replyTo: email.trim(),
      subject: subject?.trim() || `Contact form message from ${name.trim()}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F5EC;">
          <h2 style="margin:0 0 4px;font-size:20px;color:#0C2340;">New contact form message</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#4a4a4a;">Submitted via nestandquill.com/contact</p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;width:100px;color:#4a4a4a;font-weight:bold;">Name</td>
              <td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#2E2E2E;">${name.trim()}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#4a4a4a;font-weight:bold;">Email</td>
              <td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#2E2E2E;">${email.trim()}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#4a4a4a;font-weight:bold;">Subject</td>
              <td style="padding:8px 12px;background:#fff;border:1px solid #ede9dc;color:#2E2E2E;">${subject?.trim() || '—'}</td>
            </tr>
          </table>

          <div style="margin-top:16px;padding:16px;background:#fff;border:1px solid #ede9dc;border-radius:8px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#4a4a4a;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
            <p style="margin:0;font-size:14px;color:#2E2E2E;line-height:1.7;white-space:pre-wrap;">${message.trim()}</p>
          </div>

          <p style="margin:24px 0 0;font-size:12px;color:#4a4a4a;">
            Reply directly to this email to respond to ${name.trim()}.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Contact form send failed:', err)
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
  }
}
