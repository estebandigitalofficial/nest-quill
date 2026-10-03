import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeEmail, guestRowsClaimableByVerifiedEmail } from './policy.ts'

const guest = (over: Record<string, unknown>) => ({ user_id: null, guest_token: 'tok', user_email: 'Parent@Example.com', status: 'complete', plan_tier: 'free', entitlement_source: null, ...over })

test('mixed-case same email matches by normalized equality', () => {
  const r = guestRowsClaimableByVerifiedEmail([guest({ user_email: 'PARENT@example.COM' })], 'parent@example.com', true)
  assert.equal(r.rows.length, 1)
  assert.equal(r.freeBooksCounted, 1)
})

test('surrounding whitespace is trimmed on both sides', () => {
  const r = guestRowsClaimableByVerifiedEmail([guest({ user_email: '  parent@example.com ' })], ' Parent@Example.com\n', true)
  assert.equal(r.rows.length, 1)
  assert.equal(normalizeEmail('  A@B.co '), 'a@b.co')
  assert.equal(normalizeEmail('   '), null)
})

test('percent and underscore are literal characters, never wildcards', () => {
  const rows = [guest({ user_email: 'pa%rent@example.com' }), guest({ user_email: 'parent@example.com' }), guest({ user_email: 'p_rent@example.com' })]
  const pct = guestRowsClaimableByVerifiedEmail(rows, 'pa%rent@example.com', true)
  assert.equal(pct.rows.length, 1)
  assert.equal(pct.rows[0].user_email, 'pa%rent@example.com')
  const under = guestRowsClaimableByVerifiedEmail(rows, 'p_rent@example.com', true)
  assert.equal(under.rows.length, 1)
  assert.equal(under.rows[0].user_email, 'p_rent@example.com')
  // A wildcard-looking verified email cannot sweep in other addresses.
  assert.equal(guestRowsClaimableByVerifiedEmail(rows, '%@example.com', true).rows.length, 0)
  assert.equal(guestRowsClaimableByVerifiedEmail(rows, 'p_rent@example.com', true).rows.some(r => r.user_email === 'parent@example.com'), false)
})

test('a different email matches nothing', () => {
  assert.equal(guestRowsClaimableByVerifiedEmail([guest({})], 'other@example.com', true).rows.length, 0)
})

test('a story already owned by anyone is never transferred', () => {
  const rows = [guest({ user_id: 'someone-else' }), guest({ user_id: 'me' })]
  assert.equal(guestRowsClaimableByVerifiedEmail(rows, 'parent@example.com', true).rows.length, 0)
})

test('repeated reconciliation is idempotent: the second run finds nothing', () => {
  const rows = [guest({})]
  const first = guestRowsClaimableByVerifiedEmail(rows, 'parent@example.com', true)
  assert.equal(first.rows.length, 1)
  for (const r of first.rows) (r as { user_id: string | null }).user_id = 'me' // what the UPDATE does
  const second = guestRowsClaimableByVerifiedEmail(rows, 'parent@example.com', true)
  assert.equal(second.rows.length, 0)
  assert.equal(second.freeBooksCounted, 0)
})

test('an unverified email reconciles nothing; counting is capped at one completed Free book', () => {
  assert.equal(guestRowsClaimableByVerifiedEmail([guest({})], 'parent@example.com', false).rows.length, 0)
  const many = [guest({}), guest({}), guest({ status: 'failed' }), guest({ plan_tier: 'story_pro' })]
  const r = guestRowsClaimableByVerifiedEmail(many, 'parent@example.com', true)
  assert.equal(r.rows.length, 4)          // ownership follows the verified email
  assert.equal(r.freeBooksCounted, 1)     // allowance impact capped
})

test('SQL and callers use normalized exact equality and the verified-email guard', () => {
  const sql = readFileSync('supabase/migrations/20240068_entitlement_foundation.sql', 'utf8')
  assert.doesNotMatch(sql, /ILIKE|LIKE /i)
  assert.match(sql, /lower\(btrim\(user_email\)\) = lower\(btrim\(p_email\)\)/)
  assert.match(sql, /lower\(btrim\(r\.user_email\)\) = lower\(btrim\(p_email\)\)/)
  assert.match(sql, /WHERE user_id IS NULL AND guest_token IS NOT NULL AND lower\(btrim\(user_email\)\)/)
  const store = readFileSync('lib/entitlements/supabaseStore.ts', 'utf8')
  assert.doesNotMatch(store, /ilike|\.or\(/)
  assert.match(store, /count_guest_free_books/)
  const callback = readFileSync('app/auth/callback/route.ts', 'utf8')
  assert.match(callback, /user\.email_confirmed_at/)
  assert.ok(callback.indexOf('email_confirmed_at') < callback.indexOf('claim_guest_stories_by_verified_email'))
  const claim = readFileSync('app/api/story/claim/route.ts', 'utf8')
  assert.doesNotMatch(claim, /claim_guest_stories_by_verified_email/) // cookie path only
})
