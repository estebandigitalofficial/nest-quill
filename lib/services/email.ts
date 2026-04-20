/**
 * EMAIL DELIVERY SERVICE
 *
 * Uses Resend to send the finished book to the user.
 * Sends a download link — NOT an attachment (PDFs can be 5-15MB, which
 * hurts deliverability and hits email provider limits).
 *
 * STATUS: STUB — template and logic built during Phase 3/4
 */

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
  // STUB — Phase 4 implementation goes here
  // Will send a warm, branded email with:
  // - Subject: "Your story about {childName} is ready!"
  // - Body: friendly message + prominent download button
  // - Footer: Nest & Quill branding

  throw new Error('sendBookReadyEmail: not yet implemented — Phase 4')
}

export async function sendSubmissionConfirmationEmail(
  toEmail: string,
  childName: string,
  requestId: string
): Promise<void> {
  // STUB — Phase 3 implementation
  // Sends a quick "we're working on your story" confirmation immediately after submission

  throw new Error('sendSubmissionConfirmationEmail: not yet implemented — Phase 3')
}
