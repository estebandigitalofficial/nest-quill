// Run: node --experimental-strip-types --test lib/services/imageBytes.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sniffImageFormat } from './imageBytes.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

test('8-9. the PDF embeds by sniffed bytes: JPEG via embedJpg, legacy PNG via embedPng, unknown rejected', () => {
  assert.equal(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])), 'jpeg')
  assert.equal(sniffImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png')
  assert.equal(sniffImageFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38])), null)
  const pdf = read('lib/services/pdf.ts')
  assert.match(pdf, /if \(format === 'jpeg'\) return doc\.embedJpg\(bytes\)/)
  assert.match(pdf, /if \(format === 'png'\) return doc\.embedPng\(bytes\)/)
  assert.equal((pdf.match(/await embedImageBytes\(doc, bytes\)/g) ?? []).length, 2, 'scene images and cover art')
  assert.ok(!/embedPng\(bytes\)\.catch/.test(pdf), 'no guess-and-catch embedding')
})

test('10. reader, library and admin resolve assets by stored path and never assume .png', () => {
  for (const rel of ['lib/services/cover.ts', 'components/account/loadThumbs.ts', 'app/api/story/[requestId]/route.ts', 'app/api/story/[requestId]/generate-pdf/route.ts', 'app/admin/stories/[requestId]/page.tsx']) {
    const src = read(rel).replace(/\/\/.*$/gm, '')
    assert.ok(!/['"`][^'"`\n]*\.png['"`]/.test(src), `${rel} must not hard-code a .png asset name`)
  }
  assert.match(read('lib/services/cover.ts'), /cover_storage_path/)
  assert.match(read('components/account/loadThumbs.ts'), /pickThumbnailPath/)
})
