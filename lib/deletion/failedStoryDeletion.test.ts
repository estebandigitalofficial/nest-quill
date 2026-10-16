// Pins the 3C-1 migration (20240074_failed_story_deletion.sql): the detached-
// purchase invariant (D3), the deletion functions' security posture, the
// entitlement RPC grant hardening, and what the migration must NOT do.
//
// The SQL itself is exercised against a local Postgres fixture (see the 3C-1
// completion report); these tests keep the committed text honest so a later
// edit cannot quietly widen scope, drop a grant or add a data change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')
const read = (name: string) => readFileSync(resolve(MIGRATIONS, name), 'utf8')
const strip = (text: string) => text.replace(/--[^\n]*/g, '')

const NEW_MIGRATION = '20240074_failed_story_deletion.sql'
const migration = read(NEW_MIGRATION)
const sql = strip(migration)
const allMigrations = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()

/** Body of one CREATE OR REPLACE FUNCTION block (from its header to the closing $$;). */
function functionBlock(name: string): string {
  const m = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))
  assert.ok(m, `CREATE OR REPLACE FUNCTION public.${name} found`)
  return m[0]
}

// The 20240068 entitlement functions whose EXECUTE is moved to service_role,
// plus the two 3C-1 functions, with the exact argument lists used in the file.
const HARDENED = [
  'delete_failed_story(UUID, UUID)',
  'complete_story_deletion(UUID, JSONB)',
  'reserve_purchase(UUID, UUID)',
  'release_purchase(UUID)',
  'reserve_subscription_unit(UUID, UUID)',
  'release_subscription_unit(UUID)',
  'reserve_free_book(UUID, INT)',
  'release_free_book(UUID)',
  'release_free_reservation(UUID)',
  'count_guest_free_books(UUID, TEXT)',
  'claim_guest_stories(UUID, UUID, INT)',
  'claim_guest_stories_by_verified_email(UUID, TEXT, INT, INT)',
  'increment_books_generated(UUID)',
  'admin_revenue_by_period(TIMESTAMPTZ, TIMESTAMPTZ)',
]

test('1. 20240074 exists, follows 20240073 and is superseded only by 20240075 (3C-1b)', () => {
  const i = allMigrations.indexOf(NEW_MIGRATION)
  assert.ok(i >= 0)
  assert.equal(allMigrations[i - 1], '20240073_deletion_schema_foundation.sql')
  assert.deepEqual(allMigrations.slice(i + 1), ['20240075_deletion_count_durability.sql'])
  assert.equal(allMigrations.filter((f) => f.startsWith('20240074')).length, 1)
})

test('2. story_purchases.consumed_request_id: nullable UUID, no foreign key, no default', () => {
  assert.match(sql, /ALTER TABLE public\.story_purchases\s+ADD COLUMN IF NOT EXISTS consumed_request_id UUID;/)
  const addColumn = sql.match(/ADD COLUMN IF NOT EXISTS consumed_request_id UUID[^;]*;/)![0]
  assert.doesNotMatch(addColumn, /REFERENCES|NOT NULL|DEFAULT/)
  // The only column this migration adds anywhere.
  assert.equal([...sql.matchAll(/ADD COLUMN/g)].length, 1)
})

test('3. detached purchases are terminal: the CHECK is exactly the approved predicate', () => {
  assert.match(
    sql,
    /ADD CONSTRAINT story_purchases_detached_terminal\s+CHECK \(consumed_request_id IS NULL OR \(request_id IS NULL AND status <> 'paid'\)\);/,
  )
  // Guarded so re-applying is a no-op.
  assert.match(sql, /conname\s*=\s*'story_purchases_detached_terminal'/)
  // It is the only constraint the migration adds.
  assert.equal([...sql.matchAll(/ADD CONSTRAINT/g)].length, 1)
})

test('4. reserve_purchase keeps the 20240068 predicate and adds consumed_request_id IS NULL', () => {
  const fn = functionBlock('reserve_purchase')
  assert.match(fn, /RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public/)
  assert.match(fn, /UPDATE public\.story_purchases SET status = 'consumed', consumed_at = now\(\)/)
  assert.match(fn, /WHERE id = p_purchase_id AND user_id = p_user_id AND status = 'paid' AND request_id IS NULL\s+AND consumed_request_id IS NULL/)
  assert.match(fn, /RETURNING id\s*\)\s*SELECT EXISTS \(SELECT 1 FROM u\);/)
})

test('5. release_purchase keeps the 20240068 predicate and adds consumed_request_id IS NULL', () => {
  const fn = functionBlock('release_purchase')
  assert.match(fn, /RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public/)
  assert.match(fn, /UPDATE public\.story_purchases SET status = 'paid', consumed_at = NULL/)
  assert.match(fn, /WHERE id = p_purchase_id AND status = 'consumed' AND request_id IS NULL\s+AND consumed_request_id IS NULL;/)
})

test('6. delete_failed_story and complete_story_deletion are SECURITY DEFINER with SET search_path = public', () => {
  for (const name of ['delete_failed_story', 'complete_story_deletion']) {
    const fn = functionBlock(name)
    assert.match(fn, /LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$/, `${name} header`)
  }
  assert.match(functionBlock('delete_failed_story'), /^CREATE OR REPLACE FUNCTION public\.delete_failed_story\(p_request_id UUID, p_user_id UUID\)\s+RETURNS JSONB/)
  assert.match(functionBlock('complete_story_deletion'), /^CREATE OR REPLACE FUNCTION public\.complete_story_deletion\(p_log_id UUID, p_counts JSONB\)\s+RETURNS BOOLEAN/)
  // Every function the migration defines carries both properties.
  const headers = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.\w+\([^)]*\)\s+RETURNS [A-Z]+ LANGUAGE \w+ ([^$]*)AS \$\$/g)]
  assert.equal(headers.length, 4, 'four functions defined')
  for (const h of headers) assert.match(h[1], /SECURITY DEFINER SET search_path = public/)
})

test('7. delete_failed_story implements the corrected eligibility, idempotency and privacy rules', () => {
  const fn = functionBlock('delete_failed_story')
  // Customers only.
  assert.match(fn, /IF p_request_id IS NULL OR p_user_id IS NULL THEN\s+RETURN jsonb_build_object\('outcome', 'not_found'\);/)
  // Row lock, then the two-branch lookup.
  assert.match(fn, /SELECT \* INTO v_row FROM public\.story_requests WHERE id = p_request_id FOR UPDATE;/)
  assert.match(fn, /IF NOT FOUND THEN[\s\S]*FROM public\.deletion_log\s+WHERE deletion_type = 'story'\s+AND subject_id = p_request_id\s+AND status IN \('started', 'completed'\);/)
  assert.match(fn, /OR v_log_actor_type <> 'customer'\s+OR v_log_actor_id IS DISTINCT FROM p_user_id THEN\s+RETURN jsonb_build_object\('outcome', 'not_found'\);/)
  assert.match(fn, /IF v_log_status = 'completed' THEN\s+RETURN jsonb_build_object\('outcome', 'already_deleted', 'log_id', v_log_id\);/)
  assert.match(fn, /'outcome', 'deleted', 'resumed', true, 'log_id', v_log_id,\s+'known_paths', '\[\]'::jsonb/)
  // Another user's live story is indistinguishable from an unknown id.
  assert.match(fn, /IF v_row\.user_id IS DISTINCT FROM p_user_id THEN\s+RETURN jsonb_build_object\('outcome', 'not_found'\);/)
  // Eligibility: archived, failed, no worker, quiescent.
  assert.match(fn, /IF v_row\.archived_at IS NULL\s+OR v_row\.status <> 'failed'\s+OR v_row\.worker_id IS NOT NULL\s+OR v_row\.updated_at >= now\(\) - interval '3 minutes' THEN\s+RETURN jsonb_build_object\('outcome', 'not_eligible'\);/)
  // Evidence row shape: story / customer / actor = caller / started.
  assert.match(fn, /INSERT INTO public\.deletion_log \(deletion_type, subject_id, actor_type, actor_id, status\)\s+VALUES \('story', p_request_id, 'customer', p_user_id, 'started'\)/)
  // D2 through the existing function, never by hand.
  assert.match(fn, /public\.release_free_reservation\(p_request_id\)/)
  assert.doesNotMatch(fn, /free_books_used/)
  // D3: stamp and clear in ONE statement.
  assert.match(fn, /UPDATE public\.story_purchases\s+SET consumed_request_id = request_id, request_id = NULL\s+WHERE request_id = p_request_id;/)
  // Known storage paths from the three columns that record objects.
  for (const col of ['s.storage_path', 'g.cover_storage_path', 'b.storage_path']) assert.match(fn, new RegExp(col.replace('.', '\\.')))
  // FK-less cleanups, by story id only.
  assert.match(fn, /DELETE FROM public\.idempotency_keys WHERE request_id = p_request_id;/)
  assert.match(fn, /DELETE FROM public\.drip_email_log WHERE reference_id = p_request_id::text;/)
  assert.match(fn, /DELETE FROM public\.notifications WHERE href = '\/story\/' \|\| p_request_id::text;/)
  // The row itself, by primary key, once.
  assert.equal([...fn.matchAll(/DELETE FROM public\.story_requests WHERE id = p_request_id;/g)].length, 1)
  // Returned counts use allow-listed keys only (deletion_log_counts_ok in 20240073).
  const allowed = new Set(['storage_objects', 'story_requests', 'generated_stories', 'story_scenes', 'book_exports', 'delivery_logs', 'processing_logs', 'image_library', 'idempotency_keys', 'drip_email_log', 'notifications', 'support_tickets', 'stories_deleted', 'purchases_detached', 'subscription_periods_detached'])
  const countsBlock = fn.match(/v_counts := jsonb_build_object\(([\s\S]*?)\);/)![1]
  const keys = [...countsBlock.matchAll(/'([a-z_]+)',/g)].map((m) => m[1])
  assert.ok(keys.length >= 10)
  for (const k of keys) assert.ok(allowed.has(k), `counts key ${k} is allow-listed`)
  // free_released is returned, never written into counts.
  assert.doesNotMatch(countsBlock, /free_released/)
})

test('8. complete_story_deletion moves started → completed only and relies on the table CHECK for counts', () => {
  const fn = functionBlock('complete_story_deletion')
  assert.match(fn, /UPDATE public\.deletion_log\s+SET status = 'completed', completed_at = now\(\), counts = COALESCE\(p_counts, '\{\}'::jsonb\)\s+WHERE id = p_log_id AND status = 'started';/)
  assert.match(fn, /RETURN FOUND;/)
  assert.doesNotMatch(fn, /'failed'|failure_code|INSERT|DELETE/)
})

test('9. every new or replaced function and every hardened entitlement RPC is service_role-only', () => {
  for (const sig of HARDENED) {
    const esc = sig.replace(/[()]/g, (c) => `\\${c}`)
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${esc} FROM PUBLIC;`), `${sig} revoked from PUBLIC`)
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${esc} FROM anon;`), `${sig} revoked from anon`)
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${esc} FROM authenticated;`), `${sig} revoked from authenticated`)
    assert.match(sql, new RegExp(`GRANT  EXECUTE ON FUNCTION public\\.${esc} TO service_role;`), `${sig} granted to service_role`)
  }
  // No other GRANT exists (nothing is opened to anon/authenticated/PUBLIC).
  const grants = [...sql.matchAll(/GRANT\s+[^;]+;/g)].map((m) => m[0])
  assert.equal(grants.length, HARDENED.length)
  for (const g of grants) assert.match(g, /TO service_role;$/)
  assert.doesNotMatch(sql, /TO (anon|authenticated|PUBLIC)\b/)
})

test('10. the hardened list matches every SECURITY DEFINER entitlement function 20240068 created (none left out)', () => {
  const foundation = strip(read('20240068_entitlement_foundation.sql'))
  const defined = [...foundation.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(
    defined.sort(),
    ['claim_guest_stories', 'claim_guest_stories_by_verified_email', 'count_guest_free_books', 'release_free_book', 'release_free_reservation', 'release_purchase', 'release_subscription_unit', 'reserve_free_book', 'reserve_purchase', 'reserve_subscription_unit'],
  )
  const hardenedNames = HARDENED.map((s) => s.replace(/\(.*$/, ''))
  for (const name of defined) assert.ok(hardenedNames.includes(name), `${name} is hardened`)
})

test('11. the migration performs no customer-data change when applied', () => {
  // Statements that run at apply time are everything outside function bodies.
  const outsideFunctions = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\n\$\$;/g, '')
  assert.doesNotMatch(outsideFunctions, /\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO|TRUNCATE)\b/i, 'no DML outside function bodies')
  assert.doesNotMatch(outsideFunctions, /\bDROP\s+(TABLE|COLUMN|INDEX|POLICY|TYPE)\b/i)
  assert.doesNotMatch(sql, /ALTER TYPE/i, 'no enum change')
  assert.doesNotMatch(sql, /CREATE TABLE/i, 'no new table')
  assert.doesNotMatch(sql, /ALTER TABLE public\.deletion_log|POLICY/i, 'deletion_log and RLS untouched')
  assert.match(sql, /NOTIFY pgrst, 'reload schema';/)
})

test('12. the only story_purchases mutation in any migration function is the explicit detach stamp; purchases are never deleted', () => {
  const purchaseUpdates = [...sql.matchAll(/UPDATE public\.story_purchases\s+SET ([\s\S]*?)\s+WHERE/g)].map((m) => m[1].replace(/\s+/g, ' ').trim())
  assert.deepEqual(purchaseUpdates.sort(), [
    "consumed_request_id = request_id, request_id = NULL",
    "status = 'consumed', consumed_at = now()", // reserve_purchase (20240068 behaviour)
    "status = 'paid', consumed_at = NULL", // release_purchase (20240068 behaviour)
  ].sort())
  for (const file of allMigrations) {
    const text = strip(read(file))
    assert.doesNotMatch(text, /(DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+(ONLY\s+)?(public\.)?story_purchases\b/i, `${file} removes purchase rows`)
  }
  assert.doesNotMatch(sql, /subscription_periods\s+SET|DELETE FROM public\.subscription_periods/, 'periods are never written')
})

test('13. scope limits: no guest_token write, no account deletion, no route or UI, no worker change', () => {
  assert.doesNotMatch(sql, /guest_token/)
  assert.doesNotMatch(sql, /auth\.users|deleteUser|'account'/)
  assert.doesNotMatch(sql, /storage\.objects|storage\.remove/)
  assert.doesNotMatch(sql, /worker_lease|CLAIMABLE|process-story/)
  // No application code in this change calls the new functions yet.
  const appDirs = ['app', 'lib', 'components']
  const walk = (dir: string): string[] => {
    const out: string[] = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name)
      if (e.isDirectory()) out.push(...walk(p))
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p)
    }
    return out
  }
  for (const dir of appDirs) {
    for (const file of walk(resolve(ROOT, dir))) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /delete_failed_story|complete_story_deletion/, `${file} must not call the deletion functions yet`)
    }
  }
})
