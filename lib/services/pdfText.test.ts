// Run: node --experimental-strip-types --test lib/services/pdfText.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDF_END_TEXT, isWinAnsiChar, toWinAnsiSafe } from './pdfText.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

test('4. the end page no longer carries a dingbat the standard fonts cannot encode', () => {
  const src = read('lib/services/pdf.ts')
  assert.ok(!src.includes('✦'), 'pdf.ts must not contain ✦')
  assert.match(src, /const endText = PDF_END_TEXT/)
  assert.equal(PDF_END_TEXT, 'The End')
})

test('5. every drawn string is WinAnsi-safe: legitimate text survives, unencodable characters are dropped', () => {
  assert.equal(toWinAnsiSafe(PDF_END_TEXT), 'The End')
  assert.equal(toWinAnsiSafe('Pip’s “tide-pool” day — café, naïve… €5 ™'), 'Pip’s “tide-pool” day — café, naïve… €5 ™')
  assert.equal(toWinAnsiSafe('✦  The End  ✦'), 'The End')
  assert.equal(toWinAnsiSafe('Marisol 🌟 follows the hum ✨'), 'Marisol follows the hum')
  assert.equal(toWinAnsiSafe('non‑breaking space and en‐dash'), 'non-breaking space and en-dash')
  assert.equal(toWinAnsiSafe(null), '')
  for (const ch of ['é', '—', '…', '“', '€']) assert.ok(isWinAnsiChar(ch.codePointAt(0)!), ch)
  for (const ch of ['✦', '★', '🌟', '中']) assert.ok(!isWinAnsiChar(ch.codePointAt(0)!), ch)
})

test('5b. the renderer applies the guard to story text, title, dedication and closing message', () => {
  const src = read('lib/services/pdf.ts')
  assert.equal((src.match(/drawPageText\(storyPage, toWinAnsiSafe\(scene\.page_text\)/g) ?? []).length, 2, 'image and text-only page branches')
  for (const field of ['title', 'subtitle', 'dedication', 'author_line']) assert.match(src, new RegExp(`toWinAnsiSafe\\(input\\.story\\.${field}\\)`))
  assert.match(src, /toWinAnsiSafe\(input\.closingMessage\)/)
})

test('6-7. cover-art path and text-only fallback remain intact', () => {
  const src = read('lib/services/pdf.ts')
  assert.match(src, /coverImageUrl\?: string \| null/)
  assert.match(src, /if \(embeddedImg\) \{/)
  assert.match(src, /\/\/ No image — center the text vertically/)
  assert.match(src, /Full-bleed, aspect-preserving cover/)
})
