// Run: node --experimental-strip-types --test lib/services/pdfDecorations.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  CLOSING_FIT, DECOR_STRINGS, DEDICATION_FIT, DEFAULT_AUTHOR_LINE, PAGE_SIZE, backLayout, dedicationLayout,
  drawBackPage, drawDedicationPage, fitTextBlock, pdfLangFrom, wrapParagraph,
} from './pdfDecorations.ts'
import { loadDecorationArt } from './pdfDecorationAssets.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const LONG_ES = '¡Para Pip, nuestro pequeño soñador! Que cada noche te lleve a un lugar nuevo: ¿una isla de caramelos?, ¿un bosque donde los búhos cuentan chistes? Nunca dejes de preguntar «¿y si…?». Con todo nuestro cariño, la abuela Ñeca, el tío Joaquín y tu perrito Peñón. Y para los sueños que aún no has tenido…'.padEnd(300, '…').slice(0, 300)
const LONG_EN = 'For Marisol, our brave explorer, who taught the whole family that a rainy afternoon is only a puddle party waiting to happen. '.repeat(3).slice(0, 300)
const MAX_CLOSING = 'Gracias por acompañar a Pip hasta la última página. ¡Hasta la próxima aventura! '.repeat(4).slice(0, 200)

async function fonts() {
  const doc = await PDFDocument.create()
  return { doc, fonts: { serif: await doc.embedFont(StandardFonts.TimesRoman), italic: await doc.embedFont(StandardFonts.TimesRomanItalic) } }
}

test('1. page size matches the book and the locale rule is the worker\'s: only "es" is Spanish', () => {
  assert.equal(PAGE_SIZE, 576)
  assert.match(read('lib/services/pdf.ts'), /const PAGE_SIZE = 576/)
  assert.equal(pdfLangFrom('es'), 'es')
  for (const v of ['en', 'EN', 'es-MX', '', null, undefined, 'fr']) assert.equal(pdfLangFrom(v), 'en')
})

test('2. localised strings are exactly the approved ones and carry no operator or legal designation', () => {
  assert.deepEqual(DECOR_STRINGS.en, { dedication: 'A Dedication', theEnd: 'The End', madeWith: 'Made with love at', site: 'nestandquill.com' })
  assert.deepEqual(DECOR_STRINGS.es, { dedication: 'Dedicatoria', theEnd: 'Fin', madeWith: 'Hecho con cariño en', site: 'nestandquill.com' })
  const src = read('lib/services/pdfDecorations.ts')
  assert.ok(!/Digital Official|Huerta Group|LLC|Inc\b|©/.test(src), 'no operator/legal text in the PDF decorations')
  assert.equal(DEFAULT_AUTHOR_LINE, 'A Nest & Quill Original')
})

test('3. 300-character dedications fit in EN and ES at or above the minimum size with no line wider than the column', async () => {
  const { fonts: f } = await fonts()
  for (const text of [LONG_EN, LONG_ES]) {
    assert.equal(text.length, 300)
    const block = fitTextBlock(text, f.italic, DEDICATION_FIT)
    assert.ok(block.fits)
    assert.ok(block.size >= DEDICATION_FIT.minSize)
    for (const line of block.lines) assert.ok(f.italic.widthOfTextAtSize(line, block.size) <= DEDICATION_FIT.maxWidth, `too wide: ${line}`)
  }
})

test('4. a 200-character closing message fits', async () => {
  const { fonts: f } = await fonts()
  assert.equal(MAX_CLOSING.length, 200)
  const block = fitTextBlock(MAX_CLOSING, f.italic, CLOSING_FIT)
  assert.ok(block.fits && block.size >= CLOSING_FIT.minSize)
})

test('5. a word wider than the column is split, never dropped or overflowed', async () => {
  const { fonts: f } = await fonts()
  const word = 'Supercalifragilisticoespialidosoextraordinariamentelargo'.repeat(2)
  const lines = wrapParagraph(`Para Imani y ${word} siempre.`, f.italic, 24, 410)
  for (const line of lines) assert.ok(f.italic.widthOfTextAtSize(line, 24) <= 410)
  assert.equal(lines.join('').replace(/\s/g, ''), `ParaImaniy${word}siempre.`)
})

test('6. paragraph breaks are preserved as gaps and counted in the height', async () => {
  const { fonts: f } = await fonts()
  const block = fitTextBlock('For Nia.\n\nBecause every great adventure needs a reader as brave as you.\nHappy birthday.', f.italic, DEDICATION_FIT)
  assert.equal(block.lines.filter(l => l === '').length, 2)
  const textLines = block.lines.length - 2
  const expected = textLines * block.size * DEDICATION_FIT.lineHeight + 2 * block.size * DEDICATION_FIT.paragraphGap!
  assert.ok(Math.abs(block.height - expected) < 1e-6)
})

test('7. layouts keep every element inside the frame for the shortest and longest texts', async () => {
  const { fonts: f } = await fonts()
  const FRAME = 26 + 12
  for (const text of ['For Theo.', LONG_ES, LONG_EN, 'For Nia.\n\nBecause.\n\nHappy birthday, little lion, from everyone who loves you more than all the stars put together.']) {
    const block = fitTextBlock(text, f.italic, DEDICATION_FIT)
    assert.ok(block.fits)
    const L = dedicationLayout(block)
    assert.ok(L.textTop <= L.dividerY - 20)
    assert.ok(L.textBottom >= L.featherY + 20)
    assert.ok(L.authorY >= FRAME + 20)
    assert.ok(L.markCy + 30 <= PAGE_SIZE - FRAME)
  }
  for (const text of [null, 'Gracias.', MAX_CLOSING]) {
    const block = text ? fitTextBlock(text, f.italic, CLOSING_FIT) : null
    const L = backLayout(block)
    if (block && L.closingTop !== null) {
      assert.ok(L.closingTop - block.height >= L.dividerY + 20)
      assert.ok(L.closingTop <= L.endY - 30)
    }
    assert.ok(L.authorY > L.logoCy + 30)
    assert.ok(L.siteY >= FRAME + 10 && L.logoCy - 25 > L.siteY)
    assert.ok(L.endY + L.endSize <= PAGE_SIZE - FRAME)
  }
})

test('8. Spanish accents and punctuation survive; emoji are dropped; both pages render with the brand art', async () => {
  const { doc, fonts: f } = await fonts()
  const art = await loadDecorationArt(doc)
  assert.ok(art.logo && art.mark)
  const ded = drawDedicationPage(doc, f, art, { dedication: LONG_ES, authorLine: 'Un original de Nest & Quill', lang: 'es' })
  const joined = ded.lines.join(' ')
  for (const ch of ['¡', '¿', 'ñ', 'Ñ', 'ó', 'í', 'ú', '«', '»', '…']) assert.ok(joined.includes(ch), `lost ${ch}`)
  const ded2 = drawDedicationPage(doc, f, art, { dedication: 'For Theo 🌟 with love ✨', authorLine: null, lang: 'en' })
  assert.equal(ded2.lines.join(' '), 'For Theo with love')
  const back = drawBackPage(doc, f, art, { closingMessage: MAX_CLOSING, authorLine: 'Escrito por mamá', lang: 'es' })
  assert.ok(back && back.fits)
  assert.equal(drawBackPage(doc, f, art, { closingMessage: null, authorLine: undefined, lang: 'en' }), null)
  assert.equal(doc.getPageCount(), 4)
  const bytes = await doc.save()
  assert.ok(bytes.length > 10_000)
})

test('9. the decoration assets are the approved brand logo derivations, not customer artwork, and need no file tracing', () => {
  const src = read('lib/services/pdfDecorationAssets.ts')
  assert.ok(!/readFile|public\/|story-images|signedUrl|fetch\(/.test(src.replace(/\/\/.*$/gm, '')), 'assets are inlined base64, no file or storage access')
  assert.match(src, /logo\.webp/)
  assert.ok(src.length < 200_000, 'keep the inlined assets small')
})
