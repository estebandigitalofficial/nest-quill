// Privacy Foundation 1 policy — story records carry no IP or geolocation.
// Run: node --experimental-strip-types --test lib/limits/storyPrivacy.test.ts
//
// Founder decision (2026-10-14): a customer's story record must not
// contain a raw IP address or IP-derived city/region/country. The IP may
// exist transiently in server memory to compute the one-way hash the
// block-only rate_limit_events log stores, and nowhere else. These tests
// read the source files so the rule survives refactors, and exercise the
// hash itself so the "one-way, no raw value" claim is checked, not assumed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { hashIp } from './ipHash.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const submitRoute = read('app/api/story/submit/route.ts')
const rateLimits = read('lib/limits/rateLimits.ts')
const ipHashSource = read('lib/limits/ipHash.ts')
const dbTypes = read('types/database.ts')
const adminDashboard = read('app/admin/page.tsx')
const adminStoryDetail = read('app/admin/stories/[requestId]/page.tsx')

const PRIVACY_FIELDS = ['ip_address', 'geo_city', 'geo_region', 'geo_country'] as const
const GEO_HEADERS = ['x-vercel-ip-city', 'x-vercel-ip-country', 'x-vercel-ip-country-region', 'x-vercel-ip-latitude', 'x-vercel-ip-longitude', 'x-real-ip', 'cf-connecting-ip', 'cf-ipcountry']

// 1-4. The story insert writes none of the four fields.
test('story submission never persists ip_address or geo fields', () => {
  for (const field of PRIVACY_FIELDS) {
    assert.doesNotMatch(submitRoute, new RegExp(`\\b${field}\\b`), `submit route must not reference ${field}`)
  }
  // The insert still carries the fields story creation depends on.
  for (const field of ['user_id', 'guest_token', 'plan_tier', 'entitlement_source', 'entitlement_ref', 'pdf_entitled', 'child_name', 'user_email', 'status']) {
    assert.match(submitRoute, new RegExp(`^\\s*${field}:`, 'm'), `story insert must still set ${field}`)
  }
})

// 3. No geolocation headers are read, and no external geolocation call exists.
test('story submission reads no geolocation headers', () => {
  for (const header of GEO_HEADERS) {
    assert.ok(!submitRoute.includes(header), `submit route must not read ${header}`)
  }
  assert.doesNotMatch(submitRoute, /ipinfo|ipapi|maxmind|geoip|ip-api|ipstack|ipgeolocation/i, 'no third-party geolocation service')
})

// Raw IP is transient: the only use of the forwarded header is as the
// argument of hashIp(), and no variable keeps the raw value around.
test('raw client IP exists only as the argument of hashIp()', () => {
  const reads = [...submitRoute.matchAll(/headers\.get\('x-forwarded-for'\)/g)]
  assert.equal(reads.length, 1, 'x-forwarded-for is read exactly once')
  assert.match(
    submitRoute,
    /const ipHash = await hashIp\(request\.headers\.get\('x-forwarded-for'\)\?\.split\(','\)\[0\]\?\.trim\(\) \?\? null\)/,
    'the forwarded header is consumed directly by hashIp()',
  )
  assert.doesNotMatch(submitRoute, /\b(ipRaw|ipAddress|ipRawForHash|clientIp)\b/, 'no named raw-IP variable')
  assert.match(submitRoute, /import \{ hashIp \} from '@\/lib\/limits\/ipHash'/)
})

// 5. Guest rate limiting and queue gating are still wired with the hash.
test('guest rate limiting and queue gate still run with the hashed IP', () => {
  assert.match(submitRoute, /checkStoryRateLimit\(\{[\s\S]*?guestEmail: !user \? formData\.userEmail : null,[\s\S]*?ipHash,[\s\S]*?isAdmin,[\s\S]*?\}\)/, 'story rate limit receives guest email + ipHash')
  assert.match(submitRoute, /checkQueueGate\(\{[\s\S]*?isGuest: !user,[\s\S]*?ipHash,[\s\S]*?\}\)/, 'queue gate receives ipHash')
  assert.match(submitRoute, /if \(!rateBlock\.allowed\)[\s\S]*?status: 429/, 'blocked submissions still answer 429')
  // Enforcement in rateLimits.ts counts per user_id / guest email; the hash
  // is written only to the block log. Guard both halves of that design.
  assert.match(rateLimits, /\.is\('user_id', null\)\.ilike\('user_email', email\)/, 'guest limit keyed by email')
  assert.match(rateLimits, /\.eq\('user_id', args\.userId\)/, 'account limit keyed by user_id')
  assert.match(rateLimits, /from\('rate_limit_events'\)\.insert\(\{[\s\S]*?ip_hash: ctx\.ip_hash \?\? null,[\s\S]*?\}\)/, 'block log stores ip_hash')
  assert.doesNotMatch(rateLimits, /ip_address|x-forwarded-for|x-real-ip/, 'rate limiter never touches a raw IP')
})

// 7. hashIp is one-way, deterministic and never returns the input.
test('hashIp is a one-way, fixed-length pseudonym that never contains the raw IP', async () => {
  assert.equal(await hashIp(null), null)
  assert.equal(await hashIp(''), null)
  const a = await hashIp('203.0.113.9')
  const b = await hashIp('203.0.113.9')
  const c = await hashIp('203.0.113.10')
  assert.ok(a && /^[0-9a-f]{16}$/.test(a), 'hash is 16 lowercase hex chars')
  assert.equal(a, b, 'deterministic, so repeated blocks correlate')
  assert.notEqual(a, c, 'different addresses hash differently')
  assert.ok(!a.includes('203') && !a.includes('113'), 'output carries no octet of the input')
  const v6 = await hashIp('2001:db8::1')
  assert.ok(v6 && /^[0-9a-f]{16}$/.test(v6) && !v6.includes('2001'), 'IPv6 handled the same way')
  assert.match(ipHashSource, /crypto\.subtle\.digest\('SHA-256'/, 'one-way digest')
  assert.doesNotMatch(ipHashSource, /^import /m, 'ipHash.ts stays dependency-free')
})

// 8. Admin surfaces no longer depend on the removed fields; the type no
// longer declares them, so any new read fails tsc.
test('admin surfaces and the StoryRequest type no longer carry ip/geo fields', () => {
  for (const field of PRIVACY_FIELDS) {
    const re = new RegExp(`\\b${field}\\b`)
    assert.doesNotMatch(adminDashboard, re, `admin dashboard must not read ${field}`)
    assert.doesNotMatch(adminStoryDetail, re, `admin story detail must not read ${field}`)
    assert.doesNotMatch(dbTypes, new RegExp(`^\\s*${field}:`, 'm'), `StoryRequest type must not declare ${field}`)
  }
  assert.ok(!adminDashboard.includes('>Location<'), 'dashboard Location column removed')
  assert.ok(!adminStoryDetail.includes('label="IP address"'), 'IP address field removed')
  assert.ok(!adminStoryDetail.includes('label="Location"'), 'Location field removed')
  // Unrelated story and customer fields stay.
  for (const label of ['Child name', 'Email', 'Plan', 'Theme', 'Status', 'Created (AZ)']) {
    assert.ok(adminStoryDetail.includes(`label="${label}"`), `story detail still shows ${label}`)
  }
})

// 9. The story path logs nothing IP-shaped.
test('story submission path does not log a raw IP', () => {
  for (const [name, src] of [['submit route', submitRoute], ['rateLimits', rateLimits], ['ipHash', ipHashSource]] as const) {
    const logs = [...src.matchAll(/console\.(log|error|warn|info)\(([^\n]*)/g)].map(m => m[2])
    for (const call of logs) {
      assert.doesNotMatch(call, /\bip(Hash|Raw|Address)?\b|forwarded|geo/i, `${name} log call must not print an IP: ${call}`)
    }
  }
})

// Nothing in the story, entitlement, admin or limits code paths writes the
// fields anywhere else either. (Deferred learning/classroom routes keep
// their own, separate tables and are out of this policy's scope.)
test('no story, entitlement, admin or limits module references the removed fields', () => {
  const dirs = ['app/api/story', 'app/admin', 'app/api/admin', 'lib/limits', 'lib/entitlements', 'lib/services', 'components/admin']
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
        const src = readFileSync(full, 'utf8')
        if (/\bgeo_(city|region|country)\b/.test(src)) offenders.push(full)
        // ip_address is also a column on deferred-product tables written by
        // lib/services/{assignmentContent,contentLibrary}.ts; only the story
        // table is in scope here.
        if (/story_requests[\s\S]{0,400}ip_address|ip_address[\s\S]{0,400}story_requests/.test(src)) offenders.push(full)
      }
    }
  }
  for (const d of dirs) walk(resolve(ROOT, d))
  assert.deepEqual(offenders, [], `files still referencing story ip/geo fields: ${offenders.join(', ')}`)
})

// 13-14. The historical cleanup and column drop ship as separate, forward-only
// migrations, and the original migration is left untouched.
test('cleanup and column-drop migrations exist and are staged correctly', () => {
  const cleanup = read('supabase/migrations/20240070_story_requests_ip_geo_cleanup.sql')
  const drop = read('supabase/migrations/20240071_story_requests_drop_ip_geo.sql')
  for (const field of PRIVACY_FIELDS) {
    assert.match(cleanup, new RegExp(`${field}\\s*=\\s*NULL`), `cleanup nulls ${field}`)
    assert.match(drop, new RegExp(`DROP COLUMN IF EXISTS ${field}`), `drop removes ${field}`)
  }
  assert.doesNotMatch(cleanup, /DROP COLUMN|DELETE FROM/i, 'cleanup only nulls values, never deletes rows or columns')
  assert.doesNotMatch(drop, /UPDATE|DELETE/i, 'drop migration only alters schema')
  const original = read('supabase/migrations/20240019_geo_tracking.sql')
  assert.match(original, /ADD COLUMN IF NOT EXISTS ip_address\s+TEXT/, 'already-applied migration 20240019 is not edited')
})
