// Server-only guards that read Beta Ops switches from app_settings and
// either return a 503/403 NextResponse or pass control back to the
// route. Each helper defaults to "enabled" so a missing row never
// silently locks the app down.
//
// Use from API routes:
//   const blocked = await gateStoryCreation()
//   if (blocked) return blocked
//
// Use from server components for boolean reads:
//   const ok = await isSettingEnabled('learning_tools_enabled')
//
// Never import this from a client component.

import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings/appSettings'

/**
 * Coerce an app_settings boolean. Tolerates a JSONB column that
 * sometimes serializes the value as a string (`"true"`/`"false"`)
 * vs. the JSON boolean (`true`/`false`) — both are common when
 * admins hand-edit via the SQL editor or via the existing PATCH
 * route. Anything unrecognised falls back to `fallback`.
 */
export async function isSettingEnabled(key: string, fallback = true): Promise<boolean> {
  const v = await getSetting<unknown>(key, fallback)
  if (v === true) return true
  if (v === false) return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return fallback
}

function disabled(message: string, code: string, status = 503): NextResponse {
  return NextResponse.json({ message, code }, { status })
}

export async function gateStoryCreation(): Promise<NextResponse | null> {
  const ok = await isSettingEnabled('story_creation_enabled')
  return ok ? null : disabled(
    "Story creation is paused while we make some updates. Please try again soon.",
    'STORY_CREATION_DISABLED',
  )
}

/**
 * Returns a 403 when guest creation is off and there's no signed-in user.
 * Pass null/undefined for `user` when the route hasn't authenticated yet
 * or the caller is anonymous.
 */
export async function gateGuestStoryCreation(user: { id: string } | null | undefined): Promise<NextResponse | null> {
  if (user) return null
  const ok = await isSettingEnabled('guest_story_creation_enabled')
  return ok ? null : disabled(
    "Guest story creation is paused. Sign in to continue.",
    'GUEST_DISABLED',
    403,
  )
}

export async function gateLearningTools(): Promise<NextResponse | null> {
  const ok = await isSettingEnabled('learning_tools_enabled')
  return ok ? null : disabled(
    "Learning tools are paused while we make some updates. Please try again soon.",
    'LEARNING_DISABLED',
  )
}

export async function gateSupportIntake(): Promise<NextResponse | null> {
  const ok = await isSettingEnabled('support_tickets_enabled')
  return ok ? null : disabled(
    "Support intake is paused. We'll be back shortly.",
    'SUPPORT_DISABLED',
  )
}
