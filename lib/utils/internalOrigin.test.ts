// Run: node --experimental-strip-types --test lib/utils/internalOrigin.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { INTERNAL_FETCH_REDIRECT, internalOrigin, internalUrl } from './internalOrigin.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const req = (url: string, headers: Record<string, string> = {}) => ({ url, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } })

test('1. internal origin is the host that served the request, never the apex that redirects', () => {
  assert.equal(internalOrigin(req('https://www.nestandquill.com/api/story/status?requestId=x')), 'https://www.nestandquill.com')
  assert.equal(internalUrl(req('https://www.nestandquill.com/api/story/status'), '/api/story/abc/generate-pdf'), 'https://www.nestandquill.com/api/story/abc/generate-pdf')
  // proxy headers win over the raw URL (Vercel sets them on every request)
  assert.equal(internalOrigin(req('http://localhost:3000/api/story/status', { 'x-forwarded-host': 'www.nestandquill.com', 'x-forwarded-proto': 'https' })), 'https://www.nestandquill.com')
  // local dev and previews point at themselves
  assert.equal(internalOrigin(req('http://localhost:3000/api/story/status')), 'http://localhost:3000')
  assert.equal(internalOrigin(req('https://nest-quill-abc-team.vercel.app/x', { 'x-forwarded-host': 'nest-quill-abc-team.vercel.app' })), 'https://nest-quill-abc-team.vercel.app')
})

test('2. the status route sends the bearer to the internal origin and refuses redirects', () => {
  const src = read('app/api/story/status/route.ts')
  assert.match(src, /internalUrl\(request, `\/api\/story\/\$\{requestId\}\/generate-pdf`\)/)
  assert.ok(!/appUrl\(`\/api\/story\/\$\{requestId\}\/generate-pdf`\)/.test(src), 'trigger must not be built from the public app URL')
  const block = src.slice(src.indexOf('const generatePdfUrl'), src.indexOf("console.error('[status] generate-pdf trigger failed'"))
  assert.match(block, /Authorization: `Bearer \$\{pdfSecret\}`/)
  assert.match(block, /redirect: INTERNAL_FETCH_REDIRECT/)
  assert.equal(INTERNAL_FETCH_REDIRECT, 'error')
})

test('3. the public canonical URL helper is unchanged (links, emails, auth redirects keep the apex)', () => {
  const src = read('lib/utils/appUrl.ts')
  assert.match(src, /const PROD_URL = 'https:\/\/nestandquill\.com'/)
  assert.match(src, /process\.env\.NEXT_PUBLIC_APP_URL/)
  // no other internal authenticated fetch is built from appUrl()
  const status = read('app/api/story/status/route.ts')
  assert.equal((status.match(/appUrl\(`\/api/g) ?? []).length, 0)
})
