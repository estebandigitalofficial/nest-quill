// Privacy Foundation 3B-1 policy — deletion schema foundation.
// Run: node --experimental-strip-types --test lib/deletion/schemaFoundation.test.ts
//
// Founder decisions (2026-10-15): commercial records (story_purchases,
// subscription_periods) must survive deletion of the owning auth.users row;
// the deletion audit record holds minimal, bounded operational evidence and
// is never client-writable; claimed-story guest_token values and the
// must_have_owner drift are left exactly as they are. These tests read the
// migration files as text so the rules survive refactors, and pin the
// historical migrations so "forward only" is checked rather than assumed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')
const read = (name: string) => readFileSync(resolve(MIGRATIONS, name), 'utf8')
// Negative assertions run on SQL with comments removed, so a comment that
// explains what the migration does NOT do cannot trip them.
const strip = (sql: string) => sql.replace(/--[^\n]*/g, '')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

const NEW_MIGRATION = '20240073_deletion_schema_foundation.sql'
const migration = read(NEW_MIGRATION)
const sql = strip(migration)
const foundation = read('20240068_entitlement_foundation.sql')
const initial = read('20240001_initial_schema.sql')
const allMigrations = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()

// Column names a CREATE TABLE block declares (two-space indented "name TYPE").
function columnsOf(createTable: string): string[] {
  const body = createTable.slice(createTable.indexOf('(') + 1)
  return [...body.matchAll(/^\s{2}([a-z_]+)\s+(UUID|TEXT|SMALLINT|INTEGER|BOOLEAN|TIMESTAMPTZ|JSONB)\b/gm)].map((m) => m[1])
}
function createTableBlock(source: string, table: string): string {
  const m = source.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\([\\s\\S]*?\\n\\);`))
  assert.ok(m, `CREATE TABLE public.${table} found`)
  return m[0]
}

const purchaseColumns = columnsOf(createTableBlock(foundation, 'story_purchases'))
const periodColumns = columnsOf(createTableBlock(foundation, 'subscription_periods'))

test('the migration follows 20240072 and is followed only by the deletion migrations 20240074 (3C-1) and 20240075 (3C-1b)', () => {
  // 20240073 was the newest file when 3B-1 shipped; 3C-1 (20240074) builds on
  // it and 3C-1b (20240075) corrects 3C-1's two functions. Each is pinned by
  // its own test file (failedStoryDeletion.test.ts, countDurability.test.ts).
  // Nothing else may follow.
  assert.equal(allMigrations.at(-3), NEW_MIGRATION)
  assert.equal(allMigrations.at(-4), '20240072_story_requests_adult_authorization.sql')
  assert.equal(allMigrations.at(-2), '20240074_failed_story_deletion.sql')
  assert.equal(allMigrations.at(-1), '20240075_deletion_count_durability.sql')
  assert.equal(allMigrations.filter((f) => f.startsWith('20240073')).length, 1)
  assert.equal(allMigrations.filter((f) => f.startsWith('20240074')).length, 1)
})

// 1. story_purchases.user_id becomes nullable.
test('1. story_purchases.user_id becomes nullable', () => {
  assert.match(sql, /ALTER TABLE public\.story_purchases\s+ALTER COLUMN user_id DROP NOT NULL;/)
  assert.match(foundation, /story_purchases \([\s\S]*?user_id\s+UUID\s+NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/, 'the original declared NOT NULL + CASCADE (what this migration changes)')
})

// 2. story_purchases.user_id uses ON DELETE SET NULL.
test('2. story_purchases.user_id FK becomes ON DELETE SET NULL and the CASCADE FK is dropped', () => {
  assert.match(sql, /ADD CONSTRAINT story_purchases_user_id_fkey\s+FOREIGN KEY \(user_id\) REFERENCES auth\.users\(id\) ON DELETE SET NULL;/)
  // The existing FK is discovered from the catalog and dropped only when it
  // is not already SET NULL, so a re-run is a no-op.
  assert.match(sql, /c\.conrelid\s+= 'public\.story_purchases'::regclass[\s\S]*?a\.attname\s+= 'user_id';[\s\S]*?IF v_name IS NOT NULL AND v_action <> 'n' THEN\s+EXECUTE format\('ALTER TABLE public\.story_purchases DROP CONSTRAINT %I', v_name\);/)
  assert.doesNotMatch(sql, /ON DELETE CASCADE/, 'the migration introduces no CASCADE anywhere')
})

// 3. subscription_periods.user_id becomes nullable.
test('3. subscription_periods.user_id becomes nullable', () => {
  assert.match(sql, /ALTER TABLE public\.subscription_periods\s+ALTER COLUMN user_id DROP NOT NULL;/)
  assert.match(foundation, /subscription_periods \([\s\S]*?user_id\s+UUID\s+NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/)
})

// 4. subscription_periods.user_id uses ON DELETE SET NULL.
test('4. subscription_periods.user_id FK becomes ON DELETE SET NULL and the CASCADE FK is dropped', () => {
  assert.match(sql, /ADD CONSTRAINT subscription_periods_user_id_fkey\s+FOREIGN KEY \(user_id\) REFERENCES auth\.users\(id\) ON DELETE SET NULL;/)
  assert.match(sql, /c\.conrelid\s+= 'public\.subscription_periods'::regclass[\s\S]*?a\.attname\s+= 'user_id';[\s\S]*?IF v_name IS NOT NULL AND v_action <> 'n' THEN\s+EXECUTE format\('ALTER TABLE public\.subscription_periods DROP CONSTRAINT %I', v_name\);/)
})

// 5. Existing purchase/subscription fields are not removed.
test('5. no commercial column, table, index or constraint other than the user_id FK is dropped or renamed', () => {
  assert.equal(purchaseColumns.length, 15, 'story_purchases columns parsed from 20240068')
  assert.equal(periodColumns.length, 12, 'subscription_periods columns parsed from 20240068')
  assert.doesNotMatch(sql, /DROP COLUMN/i)
  assert.doesNotMatch(sql, /DROP TABLE/i)
  assert.doesNotMatch(sql, /DROP INDEX/i)
  assert.doesNotMatch(sql, /RENAME/i)
  assert.doesNotMatch(sql, /ALTER COLUMN \w+ TYPE/i)
  assert.doesNotMatch(sql, /SET DEFAULT|DROP DEFAULT/i)
  // The only columns the migration alters are the two user_id columns.
  const altered = [...sql.matchAll(/ALTER COLUMN (\w+)/g)].map((m) => m[1])
  assert.deepEqual(altered, ['user_id', 'user_id'])
  // The only DROP CONSTRAINT is the catalog-discovered user_id FK (inside the DO blocks).
  const drops = [...sql.matchAll(/DROP CONSTRAINT ([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(drops, ['%I', '%I'])
  // Every CHECK the entitlement migration gave these tables is still in force
  // because nothing here touches them; the status / tier vocabularies in
  // particular are not widened.
  const commercialAlters = [...sql.matchAll(/ALTER TABLE public\.(?:story_purchases|subscription_periods)\b[\s\S]*?;/g)].map((m) => m[0])
  assert.equal(commercialAlters.length, 6, 'two DROP NOT NULL, two ADD CONSTRAINT, two DROP CONSTRAINT templates')
  for (const stmt of commercialAlters) {
    assert.doesNotMatch(stmt, /\bCHECK\b/, 'no CHECK is added to or changed on a commercial table')
    assert.doesNotMatch(stmt, /\bUNIQUE\b/, 'no UNIQUE is added to a commercial table')
  }
})

// 6. deletion_log is not publicly/client writable.
test('6. deletion_log is service-role only: RLS on, one service_role policy, API roles revoked', () => {
  assert.match(sql, /ALTER TABLE public\.deletion_log ENABLE ROW LEVEL SECURITY;/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.deletion_log FROM anon, authenticated;/)
  const policies = [...sql.matchAll(/CREATE POLICY (\w+) ON public\.deletion_log[\s\S]*?;/g)]
  assert.equal(policies.length, 1, 'exactly one policy')
  assert.match(policies[0][0], /FOR ALL\s+USING \(auth\.role\(\) = 'service_role'\)\s+WITH CHECK \(auth\.role\(\) = 'service_role'\);/)
  assert.doesNotMatch(sql, /GRANT[^;]*ON TABLE public\.deletion_log/i, 'no table grant is added')
  assert.doesNotMatch(sql, /TO (anon|authenticated|PUBLIC)\b/i, 'nothing is granted to API roles')
  assert.doesNotMatch(sql, /auth\.uid\(\)/, 'no per-user policy: customers never read their own deletion rows directly')
  // The CHECK helper is not callable by API roles either.
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.deletion_log_counts_ok\(JSONB\) FROM PUBLIC, anon, authenticated;/)
  assert.doesNotMatch(sql, /SECURITY DEFINER/, 'no definer function that a client could call to write')
})

// 7. deletion_log cannot casually store arbitrary unbounded values.
test('7. deletion_type, actor_type, status, failure_code and counts are all bounded; no free-text or PII column exists', () => {
  const table = createTableBlock(sql, 'deletion_log')
  assert.match(table, /deletion_type\s+TEXT\s+NOT NULL CHECK \(deletion_type IN \('story', 'account'\)\)/)
  assert.match(table, /actor_type\s+TEXT\s+NOT NULL CHECK \(actor_type IN \('customer', 'admin', 'system'\)\)/)
  assert.match(table, /status\s+TEXT\s+NOT NULL DEFAULT 'started' CHECK \(status IN \('started', 'completed', 'failed'\)\)/)
  assert.match(table, /failure_code\s+TEXT\s+CHECK \(failure_code IS NULL OR failure_code ~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'\)/)
  assert.match(table, /counts\s+JSONB\s+NOT NULL DEFAULT '\{\}'::jsonb CHECK \(public\.deletion_log_counts_ok\(counts\)\)/)
  // counts: object only, allow-listed keys, non-negative integer values.
  assert.match(sql, /jsonb_typeof\(p\) = 'object'/)
  assert.match(sql, /kv\.key NOT IN \(/)
  assert.match(sql, /jsonb_typeof\(kv\.value\) <> 'number'/)
  assert.match(sql, /\(kv\.value\)::text !~ '\^\[0-9\]\{1,9\}\$'/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.deletion_log_counts_ok\(p JSONB\)\s+RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT/)
  // Lifecycle and actor shapes are constrained too.
  assert.match(table, /CONSTRAINT deletion_log_actor_shape CHECK/)
  assert.match(table, /CONSTRAINT deletion_log_lifecycle_shape CHECK/)
  // Idempotency: one live or completed record per subject.
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_log_subject_active\s+ON public\.deletion_log \(deletion_type, subject_id\)\s+WHERE status IN \('started', 'completed'\);/)

  // Column inventory: exactly these, and the only TEXT columns are the four bounded ones.
  const cols = columnsOf(table)
  assert.deepEqual(cols, ['id', 'deletion_type', 'subject_id', 'parent_id', 'actor_type', 'actor_id', 'status', 'started_at', 'completed_at', 'failure_code', 'counts'])
  const textCols = [...table.matchAll(/^\s{2}([a-z_]+)\s+TEXT\b/gm)].map((m) => m[1])
  assert.deepEqual(textCols.sort(), ['actor_type', 'deletion_type', 'failure_code', 'status'])
  for (const forbidden of ['email', 'ip', 'geo', 'city', 'country', 'note', 'reason', 'message', 'child', 'prompt', 'dedication', 'character', 'token', 'payload', 'name', 'description', 'text', 'stripe']) {
    assert.ok(!cols.some((c) => c.includes(forbidden)), `no deletion_log column named like "${forbidden}"`)
  }
  // The allow-list of count keys names tables and counters only; none is a PII field.
  const allow = sql.match(/kv\.key NOT IN \(([\s\S]*?)\)\s+OR jsonb_typeof/)
  assert.ok(allow)
  const keys = [...allow[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.ok(keys.length >= 10 && keys.length <= 20, 'allow-list stays small')
  for (const k of keys) assert.match(k, /^(storage_objects|stories_deleted|purchases_detached|subscription_periods_detached|[a-z_]+)$/)
  // Keys are table names or counters ("drip_email_log" names a table whose
  // rows were removed); none is itself a personal-data field.
  const PII_KEY = /^(email|user_email|recipient_email|ip|ip_address|ip_hash|guest_token|child_name|child_description|dedication|dedication_text|custom_notes|supporting_characters|prompt|image_prompt|geo_[a-z_]+|[a-z_]+_(email|token|name|description|prompt))$/
  for (const k of keys) assert.ok(!PII_KEY.test(k), `count key "${k}" is named after a personal-data field`)
})

// 8. No migration updates existing story_requests.guest_token values.
test('8. no migration (this one included) writes story_requests.guest_token', () => {
  assert.doesNotMatch(sql, /guest_token/, 'the new migration never mentions guest_token outside comments')
  assert.doesNotMatch(sql, /(ALTER TABLE|UPDATE|DELETE FROM|INSERT INTO|TRUNCATE|DROP TABLE)\s+(public\.)?story_requests\b/i, 'the new migration never touches the story_requests table (the word appears only as a count key)')
  let updates = 0
  for (const file of allMigrations) {
    const text = strip(read(file))
    for (const m of text.matchAll(/UPDATE\s+(?:public\.)?story_requests\s+SET\s+([\s\S]*?)\s+WHERE/gi)) {
      updates++
      assert.doesNotMatch(m[1], /\bguest_token\s*=/, `${file}: an UPDATE of story_requests assigns guest_token`)
    }
  }
  assert.ok(updates >= 4, 'the known story_requests UPDATEs (genre backfill, free release, two claim functions, ip cleanup) were scanned')
})

// 9. No migration changes must_have_owner.
test('9. must_have_owner is declared only in 20240001 and is untouched; historical migrations are byte-identical', () => {
  assert.doesNotMatch(sql, /must_have_owner/)
  assert.match(initial, /CONSTRAINT must_have_owner CHECK \(user_id IS NOT NULL OR guest_token IS NOT NULL\)/)
  for (const file of allMigrations) {
    if (file === '20240001_initial_schema.sql') continue
    assert.doesNotMatch(strip(read(file)), /must_have_owner/, `${file} must not add, drop or alter must_have_owner`)
  }
  // Forward only: the files this migration builds on are the ones that shipped.
  assert.equal(sha256(initial), 'b73553546c11f1720ce636e4c89a92b4f06e4a952bf24b030dca10bffd9db193', '20240001_initial_schema.sql unchanged')
  assert.equal(sha256(foundation), 'cf244531914bda15dbaf9feb98c6036446ece76c0c72da98bbf81d3c3ee0066b', '20240068_entitlement_foundation.sql unchanged')
})

// 10. No migration deletes existing commercial records.
test('10. no migration deletes, truncates or rewrites story_purchases / subscription_periods rows', () => {
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i)
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i)
  assert.doesNotMatch(sql, /\bUPDATE\s+(?:public\.)?\w+\s+SET\b/i, 'the new migration has no UPDATE at all')
  assert.doesNotMatch(sql, /\bINSERT\s+INTO\b/i, 'the new migration inserts nothing')
  for (const file of allMigrations) {
    const text = strip(read(file))
    assert.doesNotMatch(text, /(DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+(ONLY\s+)?(public\.)?(story_purchases|subscription_periods)\b/i, `${file} removes commercial rows`)
    assert.doesNotMatch(text, /DROP TABLE(\s+IF EXISTS)?\s+(public\.)?(story_purchases|subscription_periods)\b/i, `${file} drops a commercial table`)
  }
})
