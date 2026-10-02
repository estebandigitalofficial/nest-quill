// Run: node --experimental-strip-types --test lib/admin/denied.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN_LOGIN_REDIRECT, adminDeniedRedirect } from './denied.ts'

test('signed-out admin visitor is sent to the login page with a return path, not the maintenance-rewritten root', () => {
  assert.equal(adminDeniedRedirect(false), '/login?next=/admin')
  assert.equal(ADMIN_LOGIN_REDIRECT.startsWith('/login'), true)
  assert.ok(!ADMIN_LOGIN_REDIRECT.startsWith('/admin'), 'must not redirect back into /admin (loop)')
})

test('signed-in non-admin keeps the existing redirect to the public root', () => {
  assert.equal(adminDeniedRedirect(true), '/')
})
