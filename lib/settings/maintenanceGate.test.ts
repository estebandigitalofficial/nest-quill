// Maintenance-mode gate policy — deterministic test over middleware.ts.
// Run: node --experimental-strip-types --test lib/settings/maintenanceGate.test.ts
//
// Decision (2026-10-14): shared Nest & Quill code always honours
// app_settings.maintenance_mode_enabled on public gated routes. No deployment
// may opt out of maintenance mode through a deployment-specific environment
// variable (the redesign's NEXT_PUBLIC_DISABLE_MAINTENANCE escape hatch was
// removed). The only thing that exempts a request is its path, via the
// MAINTENANCE_BYPASS prefix list, which this test leaves untouched.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const middleware = readFileSync(resolve(ROOT, 'middleware.ts'), 'utf8')

// Environment variables the middleware legitimately reads: the two that
// isMaintenanceModeOn() needs to query app_settings. Anything else is a
// deployment-specific switch and fails the test.
const ALLOWED_ENV = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

test('maintenance gate cannot be disabled per deployment', () => {
  // (a) The removed escape hatch, under any prefix or spelling, must not return.
  assert.doesNotMatch(middleware, /DISABLE_MAINTENANCE/, 'middleware must not reference DISABLE_MAINTENANCE')
  assert.doesNotMatch(middleware, /maintenanceDisabled/, 'middleware must not keep a maintenanceDisabled switch')

  // (b) Structural: the middleware reads no env var other than the two the
  // Supabase lookup needs, so a renamed bypass (SKIP_MAINTENANCE, PREVIEW_MODE,
  // ...) fails here even if it avoids the names above.
  const envReads = [...middleware.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map(m => m[1])
  assert.ok(envReads.length > 0, 'expected the Supabase lookup to read env vars')
  for (const name of envReads) {
    assert.ok(ALLOWED_ENV.has(name), `middleware reads unexpected env var ${name}`)
  }
  assert.doesNotMatch(middleware, /process\.env\[/, 'middleware must not read env vars dynamically')

  // (c) The public maintenance check is conditioned on the path-bypass decision
  // alone: `if (!bypassed) { ... await isMaintenanceModeOn() ... }` with no
  // other operand in the condition. Whitespace-insensitive so formatting
  // changes stay harmless.
  const gate = /if\s*\(\s*!bypassed\s*\)\s*\{\s*const\s+inMaintenance\s*=\s*await\s+isMaintenanceModeOn\(\)/
  assert.match(middleware, gate, 'maintenance lookup must be gated only by !bypassed')
  assert.doesNotMatch(middleware, /!bypassed\s*&&|&&\s*!bypassed|!bypassed\s*\|\||\|\|\s*!bypassed/, 'the bypass decision must not be combined with another condition')

  // (d) The lookup is still wired to the rewrite, so the gate is not a no-op.
  assert.match(middleware, /if\s*\(\s*inMaintenance\s*\)\s*\{\s*return\s+NextResponse\.rewrite\(\s*new\s+URL\(\s*'\/maintenance'/, 'maintenance must still rewrite to /maintenance')
})
