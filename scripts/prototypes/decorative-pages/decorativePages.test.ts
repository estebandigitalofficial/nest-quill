// Run: node --experimental-strip-types --test scripts/prototypes/decorative-pages/decorativePages.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  CLOSING_FIT, DEDICATION_FIT, PAGE_SIZE, STRINGS, drawBackPage, drawDedicationPage, fitTextBlock, loadFonts, wrapParagraph,
} from './decorativePages.ts'

const HERE = import.meta.dirname
const ROOT = resolve(HERE, '../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const LONG_ES = '¡Para Pip, nuestro pequeño soñador! Que cada noche te lleve a un lugar nuevo: ¿una isla de caramelos?, ¿un bosque donde los búhos cuentan chistes? Nunca dejes de preguntar «¿y si…?». Con todo nuestro cariño, la abuela Ñeca, el tío Joaquín y tu perrito Peñón. Y para los sueños que aún no has tenido…'
const MAX_WORD = 'Supercalifragilisticoespialidosoextraordinariamentelargo'.repeat(2)

test('1. prototype stays isolated: production PDF export never imports it and it never imports production pdf.ts', () => {
  const prod = read('lib/services/pdf.ts')
  assert.ok(!prod.includes('decorativePages'), 'lib/services/pdf.ts must not reference the prototype')
  const proto = read('scripts/prototypes/decorative-pages/decorativePages.ts')
  assert.ok(!/from ['"][^'"]*services\/pdf(\.ts)?['"]/.test(proto), 'prototype must not import lib/services/pdf.ts')
  for (const f of readdirSync(resolve(ROOT, 'app/api'), { recursive: true }) as string[]) {
    if (!f.endsWith('.ts')) continue
    assert.ok(!read(resolve('app/api', f)).includes('prototypes/decorative-pages'), `${f} imports the prototype`)
  }
})

test('2. page size matches the production book (576 pt square)', () => {
  assert.equal(PAGE_SIZE, 576)
  assert.match(read('lib/services/pdf.ts'), /const PAGE_SIZE = 576/)
})

test('3. a 300-character dedication fits the block at or above the minimum size, EN and ES', async () => {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  for (const text of [LONG_ES.padEnd(300, '…').slice(0, 300), ('For Marisol, our brave explorer, who taught the whole family that a rainy afternoon is only a puddle party. ').repeat(3).slice(0, 300)]) {
    assert.equal(text.length, 300)
    const block = fitTextBlock(text, fonts.italic, DEDICATION_FIT)
    assert.ok(block.fits, 'block must fit')
    assert.ok(block.size >= DEDICATION_FIT.minSize)
    for (const line of block.lines) assert.ok(fonts.italic.widthOfTextAtSize(line, block.size) <= DEDICATION_FIT.maxWidth, `line too wide: ${line}`)
    assert.ok(block.height <= DEDICATION_FIT.maxHeight)
  }
})

test('4. a 200-character closing message fits the back-page block', async () => {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const text = ('Gracias por acompañar a Pip hasta la última página. ¡Hasta la próxima aventura! ').repeat(4).slice(0, 200)
  const block = fitTextBlock(text, fonts.italic, CLOSING_FIT)
  assert.ok(block.fits)
  assert.ok(block.size >= CLOSING_FIT.minSize)
})

test('5. a word wider than the column is split instead of overflowing', async () => {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const lines = wrapParagraph(`Para Imani y ${MAX_WORD} siempre.`, fonts.italic, 22, 400)
  for (const line of lines) assert.ok(fonts.italic.widthOfTextAtSize(line, 22) <= 400, `overflow: ${line}`)
  assert.ok(lines.join('').includes('Supercali'), 'the long word is still present')
})

test('6. paragraph breaks are honoured and blank lines count toward the height', async () => {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const block = fitTextBlock('For Nia.\n\nBecause every great adventure needs a reader as brave as you.', fonts.italic, DEDICATION_FIT)
  assert.equal(block.lines.filter(l => l === '').length, 1)
  assert.equal(block.height, block.lines.length * block.size * DEDICATION_FIT.lineHeight)
})

test('7. Spanish accents and punctuation survive the WinAnsi guard and the pages render', async () => {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const block = drawDedicationPage(doc, fonts, {}, { dedication: LONG_ES, authorLine: 'Un original de Nest & Quill', lang: 'es' })
  const joined = block.lines.join(' ')
  for (const ch of ['¡', '¿', 'ñ', 'Ñ', 'ó', 'í', 'ú', '«', '»', '…']) assert.ok(joined.includes(ch), `lost ${ch}`)
  const back = drawBackPage(doc, fonts, {}, { closingMessage: '¡Gracias por leer! ¿Quién sabe qué pasará mañana?', authorLine: 'x', lang: 'es' })
  assert.ok(back && back.fits)
  assert.equal(doc.getPageCount(), 2)
  const bytes = await doc.save()
  assert.ok(bytes.length > 1000)
})

test('8. end-of-book line and labels are localised, and emoji never reach the page', async () => {
  assert.equal(STRINGS.en.theEnd, 'The End')
  assert.equal(STRINGS.es.theEnd, 'Fin')
  assert.equal(STRINGS.es.dedication, 'Dedicatoria')
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const block = drawDedicationPage(doc, fonts, {}, { dedication: 'For Theo 🌟 with love ✨', authorLine: 'x', lang: 'en' })
  assert.equal(block.lines.join(' '), 'For Theo with love')
})

test('9. back page without a closing message renders a single page with no text block', async () => {
  const doc = await PDFDocument.create()
  const fonts = await loadFonts(doc)
  const block = drawBackPage(doc, fonts, {}, { closingMessage: null, authorLine: 'A Nest & Quill Original', lang: 'en' })
  assert.equal(block, null)
  assert.equal(doc.getPageCount(), 1)
})

test('10. fixtures are synthetic: no customer name, request id or storage path appears in the renderer', () => {
  const src = read('scripts/prototypes/decorative-pages/render.ts')
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(src), 'no UUIDs')
  assert.ok(!/story-images|book-exports|createClient|signedUrl|api\.openai|process\.env/i.test(src), 'no storage, client or provider code')
  assert.ok(!/Paysoneaux/i.test(src), 'no real customer name')
})
