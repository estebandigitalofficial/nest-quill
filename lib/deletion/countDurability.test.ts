// Pins the 3C-1b migration (20240075_deletion_count_durability.sql): it may
// redefine exactly the two 20240074 deletion functions, with exactly three
// bounded textual changes, and nothing else. 20240074 is pinned by hash so
// the historical source cannot be edited in its place.
//
// Behaviour (crash/resume, merge, CHECK, grants, concurrency) is proven
// against a local Postgres 16 fixture; see the 3C-1b completion report.
// Run: node --experimental-strip-types --test lib/deletion/countDurability.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')
const read = (name: string) => readFileSync(resolve(MIGRATIONS, name), 'utf8')
const strip = (text: string) => text.replace(/--[^\n]*/g, '')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

const NEW = '20240075_deletion_count_durability.sql'
const PREV = '20240074_failed_story_deletion.sql'
const migration = read(NEW)
const sql = strip(migration)
const prevSql = strip(read(PREV))
const all = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()

function functionBlock(source: string, name: string): string {
  const m = source.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))
  assert.ok(m, `CREATE OR REPLACE FUNCTION public.${name} found`)
  return m[0]
}
/** The migration text with every function body removed, so statement-level checks see only top-level DDL/DCL. */
const outsideFunctions = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\n\$\$;/g, '')

test('1. 20240075 is the newest migration and unique', () => {
  assert.equal(all.at(-1), NEW)
  assert.equal(all.at(-2), PREV)
  assert.equal(all.filter((f) => f.startsWith('20240075')).length, 1)
})

test('2. 20240074 is unchanged as historical source (hash pinned)', () => {
  assert.equal(sha256(read(PREV)), 'dbb996df4f7a502bfd196f5f8fbb9046f89d4457b23d90b85f199ce9fb6427fe', `${PREV} must not be edited; corrections go in a new migration`)
  assert.equal(sha256(read('20240073_deletion_schema_foundation.sql')), '1a75a2f72346b3dc9cda36f6aba9ee56c0f3e20858961f87b55ac88d7c2f2827', '20240073 unchanged (deletion_log, counts allow-list)')
})

test('3. 20240075 replaces exactly delete_failed_story(UUID, UUID) and complete_story_deletion(UUID, JSONB)', () => {
  const created = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(([^)]*)\)/g)].map((m) => `${m[1]}(${m[2]})`)
  assert.deepEqual(created, ['delete_failed_story(p_request_id UUID, p_user_id UUID)', 'complete_story_deletion(p_log_id UUID, p_counts JSONB)'])
  assert.equal([...sql.matchAll(/CREATE (OR REPLACE )?FUNCTION/g)].length, 2)
  assert.doesNotMatch(sql, /DROP FUNCTION|ALTER FUNCTION/)
})

test('4. no table, column, enum, index, policy or RLS change; grants only on the two functions', () => {
  assert.doesNotMatch(outsideFunctions, /CREATE TABLE|ALTER TABLE|DROP TABLE|ADD COLUMN|DROP COLUMN|ALTER COLUMN|CREATE TYPE|ALTER TYPE|CREATE INDEX|DROP INDEX|CREATE POLICY|DROP POLICY|ALTER POLICY|ENABLE ROW LEVEL|DISABLE ROW LEVEL|CREATE TRIGGER|CREATE SCHEMA|CREATE EXTENSION/)
  const grantTargets = [...outsideFunctions.matchAll(/(?:REVOKE ALL|GRANT\s+EXECUTE) ON FUNCTION public\.([a-z_]+\([^)]*\))/g)].map((m) => m[1])
  assert.deepEqual([...new Set(grantTargets)].sort(), ['complete_story_deletion(UUID, JSONB)', 'delete_failed_story(UUID, UUID)'])
  for (const fn of ['delete_failed_story(UUID, UUID)', 'complete_story_deletion(UUID, JSONB)']) {
    const esc = fn.replace(/[()]/g, '\\$&')
    for (const role of ['PUBLIC', 'anon', 'authenticated']) assert.match(outsideFunctions, new RegExp(`REVOKE ALL ON FUNCTION public\\.${esc} FROM ${role};`))
    assert.match(outsideFunctions, new RegExp(`GRANT  EXECUTE ON FUNCTION public\\.${esc} TO service_role;`))
  }
  assert.doesNotMatch(outsideFunctions, /GRANT[^;]*TO (anon|authenticated|PUBLIC)/)
  // deletion_log_counts_ok is not widened and no new count key appears anywhere
  assert.doesNotMatch(sql, /deletion_log_counts_ok/)
  const prevKeys = new Set([...prevSql.matchAll(/'([a-z_]+)',\s+v_[a-z]+/g)].map((m) => m[1]))
  const newKeys = new Set([...sql.matchAll(/'([a-z_]+)',\s+v_[a-z]+/g)].map((m) => m[1]))
  assert.deepEqual([...newKeys].sort(), [...prevKeys].sort(), 'the counts object has the same eleven keys as 20240074')
})

test('5. no migration-time INSERT/UPDATE/DELETE: the only DML lives inside the function bodies', () => {
  assert.doesNotMatch(outsideFunctions, /\b(INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\b/)
  // The one new statement inside delete_failed_story is the evidence UPDATE on the function's own record.
  const fn = functionBlock(sql, 'delete_failed_story')
  const updates = [...fn.matchAll(/UPDATE public\.([a-z_]+)/g)].map((m) => m[1])
  assert.deepEqual(updates, ['story_purchases', 'deletion_log'])
  const deletes = [...fn.matchAll(/DELETE FROM public\.([a-z_]+)/g)].map((m) => m[1])
  assert.deepEqual(deletes, ['idempotency_keys', 'drip_email_log', 'notifications', 'story_requests'], 'same four deletes as 20240074, same order')
})

test('6. delete_failed_story = 20240074 body + exactly the three bounded changes', () => {
  const prev = functionBlock(prevSql, 'delete_failed_story')
  const next = functionBlock(sql, 'delete_failed_story')
  const old1 = `    SELECT id, status, actor_type, actor_id
      INTO v_log_id, v_log_status, v_log_actor_type, v_log_actor_id
      FROM public.deletion_log`
  const new1 = `    SELECT id, status, actor_type, actor_id, counts
      INTO v_log_id, v_log_status, v_log_actor_type, v_log_actor_id, v_counts
      FROM public.deletion_log`
  const old2 = `'known_paths', '[]'::jsonb, 'counts', '{}'::jsonb, 'free_released', false`
  const new2 = `'known_paths', '[]'::jsonb, 'counts', COALESCE(v_counts, '{}'::jsonb), 'free_released', false`
  const old3 = `    'notifications',      v_notes
  );

  RETURN jsonb_build_object(
    'outcome', 'deleted', 'resumed', false, 'log_id', v_log_id,`
  const new3 = `    'notifications',      v_notes
  );

  UPDATE public.deletion_log
     SET counts = v_counts
   WHERE id = v_log_id
     AND status = 'started';

  RETURN jsonb_build_object(
    'outcome', 'deleted', 'resumed', false, 'log_id', v_log_id,`
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  for (const [o, n] of [[old1, new1], [old2, new2], [old3, new3]]) {
    assert.ok(norm(prev).includes(norm(o)), 'old text present in 20240074')
    assert.ok(norm(next).includes(norm(n)), 'new text present in 20240075')
    assert.ok(!norm(next).includes(norm(o)), 'old text gone from 20240075')
  }
  const rebuilt = prev.replace(old1, new1).replace(old2, new2).replace(old3, new3)
  assert.equal(norm(next), norm(rebuilt), 'nothing else in the function body changed')
  // Header, security posture and the unchanged semantics are still there.
  assert.match(next, /RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$/)
  assert.match(next, /v_row\.updated_at >= now\(\) - interval '3 minutes'/)
  assert.match(next, /SET consumed_request_id = request_id, request_id = NULL/)
  assert.match(next, /public\.release_free_reservation\(p_request_id\)/)
  assert.match(next, /'outcome', 'not_found'/)
  assert.match(next, /'outcome', 'not_eligible'/)
  assert.match(next, /'outcome', 'already_deleted'/)
})

test('7. the evidence UPDATE sits after the story row DELETE and before RETURN, in the same transaction', () => {
  const fn = functionBlock(sql, 'delete_failed_story')
  const del = fn.indexOf('DELETE FROM public.story_requests WHERE id = p_request_id;')
  const counts = fn.indexOf('v_counts := jsonb_build_object(')
  const persist = fn.indexOf("UPDATE public.deletion_log\n     SET counts = v_counts\n   WHERE id = v_log_id\n     AND status = 'started';")
  const ret = fn.indexOf("'outcome', 'deleted', 'resumed', false")
  assert.ok(del > 0 && counts > del && persist > counts && ret > persist, 'order: DELETE → build counts → persist → RETURN')
  assert.doesNotMatch(fn, /COMMIT|ROLLBACK|dblink|pg_background|PERFORM public\.complete_story_deletion/, 'no autonomous transaction tricks: it commits with the delete')
})

test('8. complete_story_deletion = 20240074 body with merge instead of replacement', () => {
  const prev = functionBlock(prevSql, 'complete_story_deletion')
  const next = functionBlock(sql, 'complete_story_deletion')
  const old = `counts = COALESCE(p_counts, '{}'::jsonb)`
  const neu = `counts = counts || COALESCE(p_counts, '{}'::jsonb)`
  assert.ok(prev.includes(old) && !prev.includes(neu))
  assert.ok(next.includes(neu))
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  assert.equal(norm(next), norm(prev.replace(old, neu)), 'nothing else changed')
  assert.match(next, /RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public/)
  assert.match(next, /WHERE id = p_log_id AND status = 'started';\s*RETURN FOUND;/)
})

test('9. the file documents the storage_objects limitation and the PostgREST reload', () => {
  assert.match(migration, /storage_objects/)
  assert.match(migration.replace(/\n-- /g, ' '), /can be lower than the historical total removed across attempts/)
  assert.match(sql, /NOTIFY pgrst, 'reload schema';/)
  assert.doesNotMatch(migration, /tombstone table|CREATE TABLE/i)
})
