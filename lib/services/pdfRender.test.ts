// Run: node --experimental-strip-types --test lib/services/pdfRender.test.ts
//
// Renders real books through generateBookPDF with synthetic data (no images,
// no network) and pins the page structure the Phase 0C decorative pages must
// preserve: cover, optional dedication, one page per scene, back page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { getDocumentProxy } from 'unpdf'

// pdf.js (via unpdf) uses Promise.try, which Node 22 lacks; the test runner shims it.
const P = Promise as unknown as { try?: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => Promise<unknown> }
if (!P.try) P.try = (fn, ...args) => new Promise(resolve => resolve(fn(...args)))
import { generateBookPDF } from './pdf.ts'
import type { GeneratedStory, StoryScene } from '../../types/database.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

function story(over: Partial<GeneratedStory> = {}): GeneratedStory {
  return {
    id: 'story-1', request_id: 'req-1', title: 'Theo and the Lantern Fox', subtitle: null, author_line: 'Written for Theo by Mom and Dad',
    dedication: null, synopsis: null, full_text_json: [], raw_llm_output: null, model_used: 'test', prompt_tokens: null,
    completion_tokens: null, generation_time_ms: null, created_at: '2026-10-30T00:00:00Z', ...over,
  } as GeneratedStory
}

function scenes(n: number): StoryScene[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `scene-${i + 1}`, request_id: 'req-1', page_number: i + 1,
    page_text: `Page ${i + 1}. Theo followed the lantern fox past the sleepy windmill and into the orchard where the pears hummed.`,
    image_prompt: 'x', image_status: 'pending', storage_path: null, revised_prompt: null, image_model: null, image_attempts: 0, image_last_error: null,
    created_at: '2026-10-30T00:00:00Z', updated_at: '2026-10-30T00:00:00Z',
  }) as unknown as StoryScene)
}

async function render(input: Parameters<typeof generateBookPDF>[0]) {
  const originalFetch = globalThis.fetch
  let fetched = 0
  globalThis.fetch = (async () => { fetched++; throw new Error('no network in tests') }) as typeof fetch
  try {
    const out = await generateBookPDF(input)
    const doc = await PDFDocument.load(out.buffer)
    return { ...out, doc, fetched }
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('1. page structure: cover + dedication (when present) + one page per scene + back page, all 8 × 8 in', async () => {
  for (const [n, ded] of [[8, null], [8, 'For Theo.'], [16, 'For Marisol.'], [24, null], [32, 'Para Pip.']] as const) {
    const r = await render({ story: story({ dedication: ded }), scenes: scenes(n), signedImageUrls: new Map(), coverImageUrl: null })
    assert.equal(r.pageCount, 1 + (ded ? 1 : 0) + n + 1, `pages for ${n} scenes, dedication=${!!ded}`)
    assert.equal(r.doc.getPageCount(), r.pageCount)
    for (const p of r.doc.getPages()) { const { width, height } = p.getSize(); assert.equal(width, 576); assert.equal(height, 576) }
    assert.equal(r.fetched, 0, 'no image URLs → no fetch')
  }
})

test('2. English and Spanish books render with their own heading and labels; unknown locale falls back to English', async () => {
  const base = { story: story({ dedication: 'For Theo, who asks the very best questions.' }), scenes: scenes(8), signedImageUrls: new Map(), coverImageUrl: null, closingMessage: 'Thank you for reading.' }
  for (const locale of ['en', 'es', null, 'fr']) {
    const r = await render({ ...base, locale })
    assert.equal(r.pageCount, 11)
  }
  // Extract the real page text: Spanish book → DEDICATORIA on page 2 and Fin on the last page; English → A DEDICATION / The End.
  for (const [locale, label, end, made] of [['es', 'DEDICATORIA', 'Fin', 'HECHOCONCARIÑOENNESTANDQUILL.COM'], ['en', 'ADEDICATION', 'TheEnd', 'MADEWITHLOVEATNESTANDQUILL.COM']] as const) {
    const r = await render({ ...base, locale })
    const pages = await pageTexts(r.buffer)
    assert.equal(pages.length, 11)
    assert.ok(pages[1].includes(label), `${locale}: dedication label, got ${pages[1].slice(0, 80)}`)
    assert.ok(pages[1].includes('ForTheo,whoasksthevery'), 'dedication text present')
    assert.ok(pages[10].includes(end), `${locale}: ending heading, got ${pages[10].slice(0, 80)}`)
    assert.ok(pages[10].includes('Thankyouforreading.'), 'closing message present')
    assert.ok(pages[10].includes('WrittenforTheobyMomandDad'), 'author line preserved verbatim')
    assert.ok(pages[10].includes(made), `${locale}: publisher line`)
    assert.ok(!pages[10].includes(locale === 'es' ? 'TheEnd' : 'Fin'), 'no mixed-language heading')
  }
})

/** Text of every page with whitespace removed (tracked labels are drawn glyph by glyph). */
async function pageTexts(buffer: Buffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const out: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    out.push(content.items.map(it => ('str' in it ? it.str : '')).join('').replace(/\s+/g, ''))
  }
  return out
}

test('3. maximum-length dedication, paragraphs, long words and the maximum closing message render without an encoding failure', async () => {
  const ded = ('¡Para Pip, nuestro pequeño soñador! ¿Una isla de caramelos? «¿Y si…?»\n\nSupercalifragilisticoespialidosoextraordinariamentelargo. ').repeat(3).slice(0, 300)
  const closing = 'Gracias por acompañar a Pip hasta la última página. ¡Hasta la próxima aventura! '.repeat(4).slice(0, 200)
  const r = await render({ story: story({ dedication: ded, author_line: 'Escrito para Pip por mamá y papá 🌟' }), scenes: scenes(8), signedImageUrls: new Map(), coverImageUrl: null, closingMessage: closing, locale: 'es' })
  assert.equal(r.pageCount, 11)
  // No silent clipping: every character of the 300-char dedication and the 200-char closing reaches the page.
  const pages = await pageTexts(r.buffer)
  const norm = (t: string) => t.replace(/[^A-Za-zÀ-ÿ¡¿«»…!?.,]/g, '')
  assert.ok(norm(pages[1]).includes(norm(ded)), 'full 300-character dedication present')
  assert.ok(pages[10].includes(closing.replace(/\s+/g, '')), 'closing message complete')
  assert.ok(pages[10].includes('EscritoparaPippormamáypapá'), 'author line kept (emoji dropped)')
})

test('4. the story-page and cover code paths are the pre-Phase-0C ones (only the dedication and back page changed)', () => {
  const src = read('lib/services/pdf.ts')
  assert.match(src, /\/\/ Image takes the top 58% of the page/)
  assert.match(src, /drawPageText\(storyPage, toWinAnsiSafe\(scene\.page_text\)/)
  assert.match(src, /Full-bleed, aspect-preserving cover/)
  assert.match(src, /const titleSize = story\.title\.length > 24 \? 28 : 34/)
  assert.match(src, /if \(story\.dedication\) \{\s*drawDedicationPage\(/)
  assert.match(src, /drawBackPage\(doc, decorFonts, decorArt, \{ closingMessage, authorLine: story\.author_line, lang \}\)/)
  assert.ok(!/drawRectangle\(\{ x: 0, y: PAGE_SIZE - 8, width: PAGE_SIZE, height: 8, color: BRAND_GOLD \}\)\s*\n\s*backPage/.test(src), 'old back page removed')
  // Author attribution is the story's own line; the decorations never invent one when it exists.
  assert.match(read('lib/services/pdfDecorations.ts'), /toWinAnsiSafe\(input\.authorLine\) \|\| DEFAULT_AUTHOR_LINE/)
})

test('5. the generate-pdf route passes the persisted story locale (not a browser language)', () => {
  const route = read('app/api/story/[requestId]/generate-pdf/route.ts')
  assert.match(route, /\.select\('plan_tier, closing_message, locale, status, completed_at, entitlement_source, pdf_entitled'\)/)
  assert.match(route, /locale: \(storyReq as unknown as \{ locale: string \| null \}\)\.locale/)
  assert.ok(!/accept-language|navigator\.language/i.test(route))
  // Export idempotency and claim logic untouched.
  assert.match(route, /exportIsCurrent\(existingExport/)
  assert.match(route, /runClaimedOnce\(pdfClaimKey\(requestId, completedAt\)/)
})
