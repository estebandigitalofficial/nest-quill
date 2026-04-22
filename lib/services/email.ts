import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export interface SendBookEmailOptions {
  toEmail: string
  childName: string
  storyTitle: string
  downloadUrl: string
  requestId: string
}

export async function sendBookReadyEmail(
  options: SendBookEmailOptions
): Promise<{ messageId: string }> {
  const { toEmail, childName, storyTitle, downloadUrl } = options

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your story is ready!</title>
</head>
<body style="margin:0;padding:0;background:#fdf8f2;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px;">
                Nest &amp; Quill
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e0d5;padding:40px 36px;">

              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:28px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                ${childName}'s story<br/>is ready! ✨
              </p>

              <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;color:#555;line-height:1.6;">
                Your personalized storybook <strong style="color:#1a1a1a;">"${storyTitle}"</strong> has been
                created and is waiting for you.
              </p>

              <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#777;line-height:1.6;">
                Tap the button below to read it online or download your PDF.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#dc8a28;border-radius:10px;">
                    <a href="${downloadUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      Read ${childName}'s story →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #ede8e0;margin:32px 0;" />

              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#aaa;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${downloadUrl}" style="color:#dc8a28;word-break:break-all;">${downloadUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbb;">
                You're receiving this because you created a story at Nest &amp; Quill.<br/>
                © ${new Date().getFullYear()} Nest &amp; Quill. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: 'Nest & Quill <stories@nestandquill.com>',
    to: toEmail,
    subject: `${childName}'s story is ready! 📖`,
    html,
  })

  if (error || !data?.id) {
    throw new Error(`Resend error: ${error?.message ?? 'unknown'}`)
  }

  return { messageId: data.id }
}

export async function sendSubmissionConfirmationEmail(
  toEmail: string,
  childName: string,
  requestId: string
): Promise<void> {
  const storyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/story/${requestId}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>We're creating ${childName}'s story</title>
</head>
<body style="margin:0;padding:0;background:#fdf8f2;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">
                Nest &amp; Quill
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e0d5;padding:40px 36px;">

              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                We're writing<br/>${childName}'s story! 🖊️
              </p>

              <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;color:#555;line-height:1.6;">
                We've got everything we need and are busy crafting a unique story just for ${childName}.
                This usually takes a few minutes.
              </p>

              <p style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#777;line-height:1.6;">
                You can check the progress anytime — we'll also send you another email when it's done.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#dc8a28;border-radius:10px;">
                    <a href="${storyUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Check progress →
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #ede8e0;margin:32px 0;" />

              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#aaa;line-height:1.6;">
                <a href="${storyUrl}" style="color:#dc8a28;word-break:break-all;">${storyUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbb;">
                You're receiving this because you created a story at Nest &amp; Quill.<br/>
                © ${new Date().getFullYear()} Nest &amp; Quill. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: 'Nest & Quill <stories@nestandquill.com>',
    to: toEmail,
    subject: `We're creating ${childName}'s story! 🖊️`,
    html,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
