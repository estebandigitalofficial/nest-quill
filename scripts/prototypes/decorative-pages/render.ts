// Phase 0B prototype renderer. Writes sample dedication / back pages as PDFs.
//
//   node --experimental-strip-types scripts/prototypes/decorative-pages/render.ts [outDir] [--v1]
//
// --v1 renders the frozen Version 1 layouts (./v1) for before/after comparison.
//
// Output: one combined proof.pdf (all variants) plus one PDF per variant.
// Optional PNGs: pdftoppm -r 72 -png <outDir>/proof.pdf <outDir>/proof
//
// All text below is synthetic and every name is fictional. Nothing is read
// from Supabase, OpenAI, or any customer record.
import { PDFDocument } from 'pdf-lib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as v2 from './decorativePages.ts'
import * as v1 from './v1/decorativePages.ts'
import type { Art, Lang } from './decorativePages.ts'

const HERE = import.meta.dirname
const args = process.argv.slice(2)
const useV1 = args.includes('--v1')
const layouts = useV1 ? v1 : v2
const outDir = resolve(args.find(a => !a.startsWith('--')) ?? resolve(HERE, 'out'))
mkdirSync(outDir, { recursive: true })

export const FIXTURES: { id: string; lang: Lang; kind: 'dedication' | 'back'; text: string | null; author: string }[] = [
  { id: '01-ded-en-short', lang: 'en', kind: 'dedication', author: 'Written for Theo by Mom and Dad', text: 'For Theo, who asks the very best questions.' },
  { id: '02-ded-en-long', lang: 'en', kind: 'dedication', author: 'A Nest & Quill Original', text:
    'For Marisol, our brave explorer, who taught the whole family that a rainy afternoon is only a puddle party waiting to happen. ' +
    'May you always find the hidden door, the friendly dragon, and the way back home for supper. With all our love — Grandma June & Grandpa Ray.' },
  { id: '03-ded-es-short', lang: 'es', kind: 'dedication', author: 'Escrito para Marisol por mamá y papá', text: 'Para Marisol, que llena la casa de canciones y preguntas.' },
  { id: '04-ded-es-long', lang: 'es', kind: 'dedication', author: 'Un original de Nest & Quill', text:
    '¡Para Pip, nuestro pequeño soñador! Que cada noche te lleve a un lugar nuevo: ¿una isla de caramelos?, ¿un bosque donde los búhos cuentan chistes? ' +
    'Nunca dejes de preguntar «¿y si…?». Con todo nuestro cariño, la abuela Ñeca, el tío Joaquín y tu perrito Peñón.' },
  { id: '05-ded-en-paragraphs', lang: 'en', kind: 'dedication', author: 'A Nest & Quill Original', text:
    'For Nia.\nBecause every great adventure needs a reader as brave as you.\nHappy seventh birthday, little lion.' },
  { id: '06-ded-stress', lang: 'es', kind: 'dedication', author: 'Un original de Nest & Quill', text:
    'Para Imani y su palabra favorita, Supercalifragilisticoespialidosoextraordinariamentelargo, y para todas las palabras que todavía no ha inventado. ' +
    'Que siempre te sobren letras para contar lo que sientes, y que nunca te falte alguien que quiera escucharlas hasta el final.' },
  { id: '07-back-en-closing', lang: 'en', kind: 'back', author: 'Written for Theo by Mom and Dad', text:
    'Thank you for reading along with Theo. Every time you open this book, the adventure begins again — and so does the love that made it.' },
  { id: '08-back-es-closing', lang: 'es', kind: 'back', author: 'Escrito para Marisol por mamá y papá', text:
    '¡Gracias por leer con Marisol! Cada vez que abras este libro, la aventura empieza otra vez: ¿quién sabe qué pasará mañana? Con cariño, tu familia.' },
  { id: '09-back-en-none', lang: 'en', kind: 'back', author: 'A Nest & Quill Original', text: null },
  { id: '10-back-es-none', lang: 'es', kind: 'back', author: 'Un original de Nest & Quill', text: null },
  { id: '11-back-es-max', lang: 'es', kind: 'back', author: 'Un original de Nest & Quill', text:
    'Gracias por acompañar a Pip hasta la última página. Ojalá este cuento te recuerde que las cosas pequeñas —una pluma, un nido, una palabra amable— pueden cambiarlo todo. ¡Hasta la próxima aventura!' },
]

async function loadArt(doc: PDFDocument): Promise<Art> {
  return {
    mark: await doc.embedPng(readFileSync(resolve(HERE, 'assets/mark.png'))),
    logo: await doc.embedPng(readFileSync(resolve(HERE, 'assets/logo.png'))),
  }
}

async function renderOne(fixture: typeof FIXTURES[number]) {
  const doc = await PDFDocument.create()
  const fonts = await layouts.loadFonts(doc)
  const art = await loadArt(doc)
  const block = fixture.kind === 'dedication'
    ? layouts.drawDedicationPage(doc, fonts, art, { dedication: fixture.text ?? '', authorLine: fixture.author, lang: fixture.lang })
    : layouts.drawBackPage(doc, fonts, art, { closingMessage: fixture.text, authorLine: fixture.author, lang: fixture.lang })
  return { bytes: await doc.save(), block }
}

async function main() {
  const proof = await PDFDocument.create()
  const report: string[] = []
  for (const f of FIXTURES) {
    const { bytes, block } = await renderOne(f)
    writeFileSync(resolve(outDir, `${f.id}.pdf`), bytes)
    const src = await PDFDocument.load(bytes)
    const [page] = await proof.copyPages(src, [0])
    proof.addPage(page)
    report.push(`${f.id}: chars=${(f.text ?? '').length} size=${block?.size ?? '-'} lines=${block?.lines.length ?? 0} fits=${block?.fits ?? 'n/a'}`)
  }
  writeFileSync(resolve(outDir, 'proof.pdf'), await proof.save())
  console.log(report.join('\n'))
  console.log(`\n${useV1 ? 'V1' : 'V2'}: wrote ${FIXTURES.length + 1} PDFs to ${outDir}`)
}

main().catch(err => { console.error(err); process.exit(1) })
