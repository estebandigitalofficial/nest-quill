// Server-only submission idempotency for /api/story/submit.
//
// Use a header-supplied X-Idempotency-Key when the client provides one,
// else derive a deterministic key from the user identity + the form
// payload. Either way the key is hashed before insert so we don't
// store sensitive payload material.
//
// Flow:
//   1. derive key
//   2. INSERT INTO idempotency_keys with placeholder request_id
//   3. ON CONFLICT — read the existing row's request_id (= duplicate hit)
//   4. on success of the eventual insert, UPDATE the key row with the
//      real request_id + status_code so a later replay can return it.
//
// Window: rows expire after 15 minutes. Reads filter on `expires_at > now()`.
//
// Never import from a client component.

import { createAdminClient } from '@/lib/supabase/admin'

const WINDOW_MINUTES = 15

export interface IdempotencyHit {
  /** True when the same key was seen recently. */
  isDuplicate: boolean
  /** The request_id of the prior submission, when known. */
  requestId: string | null
  /** Internal id of the key row, used to update later. */
  keyRowId: number | null
  /** Original status code of the prior response (200, 4xx, etc.). */
  statusCode: number
}

/**
 * Derive a deterministic key from auth identity + the relevant form
 * inputs. Identical resubmits within the window dedupe. Different
 * inputs produce different keys.
 */
export async function deriveStorySubmissionKey(args: {
  /** Either the user_id or guest_token, whichever's available. */
  identity: string | null
  /** Falls back to the email when there's no identity. */
  email: string | null
  /** Form fields that, taken together, identify "the same submission". */
  childName: string
  childAge: number
  storyTheme: string
  planTier: string
  storyLength: number
}): Promise<string> {
  const id = (args.identity ?? args.email ?? 'anon').toLowerCase().trim()
  const payload = [
    id,
    args.childName.toLowerCase().trim(),
    args.childAge,
    args.storyTheme.toLowerCase().trim(),
    args.planTier,
    args.storyLength,
  ].join('|')
  const buf = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Reserve the key. If a non-expired row already exists for this key,
 * returns the prior row's request_id so the caller can short-circuit
 * with that. If the table is missing (migration not applied) the
 * helper degrades to "not duplicate" so the submit path keeps working.
 */
export async function reserveIdempotencyKey(key: string, scope = 'story_submit'): Promise<IdempotencyHit> {
  const db = createAdminClient()

  // Existence probe — non-expired only.
  const { data: existing, error: readErr } = await db
    .from('idempotency_keys')
    .select('id, request_id, status_code')
    .eq('key', key)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (readErr?.code === '42P01') {
    // Table missing — degrade gracefully. The submit path proceeds
    // without idempotency until the migration lands.
    return { isDuplicate: false, requestId: null, keyRowId: null, statusCode: 0 }
  }
  if (existing?.id) {
    return {
      isDuplicate: true,
      requestId: (existing.request_id as string | null) ?? null,
      keyRowId: existing.id as number,
      statusCode: (existing.status_code as number) ?? 200,
    }
  }

  // First sighting — insert a placeholder row. ON CONFLICT shouldn't
  // fire because expires_at filtering already showed nothing, but the
  // unique index on `key` makes this race-safe: a concurrent insert
  // would hit a 23505 and we re-read.
  const expires = new Date(Date.now() + WINDOW_MINUTES * 60_000).toISOString()
  const { data: inserted, error: insertErr } = await db
    .from('idempotency_keys')
    .insert({ key, scope, expires_at: expires })
    .select('id')
    .single()

  if (insertErr?.code === '23505') {
    // Concurrent insert won — re-read.
    const { data: rematch } = await db
      .from('idempotency_keys')
      .select('id, request_id, status_code')
      .eq('key', key)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return {
      isDuplicate: true,
      requestId: (rematch?.request_id as string | null) ?? null,
      keyRowId: (rematch?.id as number | null) ?? null,
      statusCode: (rematch?.status_code as number) ?? 200,
    }
  }

  return { isDuplicate: false, requestId: null, keyRowId: (inserted?.id as number | null) ?? null, statusCode: 0 }
}

/**
 * Annotate the key row with the request_id + final status once the
 * submission has actually been recorded. Best-effort.
 */
export async function finalizeIdempotencyKey(keyRowId: number | null, requestId: string, statusCode: number): Promise<void> {
  if (keyRowId === null) return
  const db = createAdminClient()
  await db.from('idempotency_keys').update({ request_id: requestId, status_code: statusCode }).eq('id', keyRowId)
}
