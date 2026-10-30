// Phase 0B prototype — VERSION 1 (frozen for before/after comparison, commit 6b2ddb3).
// Phase 0B prototype — decorative dedication and back pages.
//
// ISOLATED EXPERIMENT. Nothing in production imports this module; the
// customer PDF export (lib/services/pdf.ts) is untouched. It renders with the
// same technology and dimensions as the real book (pdf-lib, 576 × 576 pt,
// WinAnsi standard fonts) so what you see here is what the production
// renderer could produce without new dependencies.
//
// Design language: cream page, oxford text, gold rules, a double-rule frame
// with corner diamonds, letter-spaced small labels, Times italic for the
// personal text, and the approved Nest & Quill mark / wordmark as the only
// artwork. No customer illustration is ever used here.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib'
import { toWinAnsiSafe } from '../../../../lib/services/pdfText.ts'

export const PAGE_SIZE = 576 // 8 × 8 in, identical to lib/services/pdf.ts

export const COLORS = {
  cream: rgb(0.973, 0.961, 0.925),   // #F8F5EC
  gold: rgb(0.788, 0.592, 0.0),      // #C99700
  goldSoft: rgb(0.902, 0.831, 0.62), // #E6D49E
  oxford: rgb(0.047, 0.137, 0.251),  // #0C2340
  charcoal: rgb(0.18, 0.18, 0.18),   // #2E2E2E
  gray: rgb(0.471, 0.443, 0.424),    // #78716c
  stone: rgb(0.66, 0.64, 0.62),      // #a8a29e
}

export type Lang = 'en' | 'es'

export const STRINGS: Record<Lang, { dedication: string; theEnd: string; madeWith: string; site: string }> = {
  en: { dedication: 'A Dedication', theEnd: 'The End', madeWith: 'Made with love at', site: 'nestandquill.com' },
  es: { dedication: 'Dedicatoria', theEnd: 'Fin', madeWith: 'Hecho con cariño en', site: 'nestandquill.com' },
}

// ── Text fitting ─────────────────────────────────────────────────────────────

export interface FitOptions {
  maxWidth: number
  maxHeight: number
  maxSize: number
  minSize: number
  lineHeight: number // multiplier
}

export interface FittedBlock {
  size: number
  lines: string[]
  height: number
  fits: boolean
}

/** Break one paragraph into lines; a word wider than the column is split by character. */
export function wrapParagraph(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/[ \t]+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  const push = () => { if (line) { lines.push(line); line = '' } }
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      push()
      let chunk = ''
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) { lines.push(chunk); chunk = '' }
        chunk += ch
      }
      line = chunk
      continue
    }
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test
    else { push(); line = word }
  }
  push()
  return lines
}

/** Largest size in [minSize, maxSize] whose wrapped block fits maxHeight. Blank lines mark paragraph breaks. */
export function fitTextBlock(text: string, font: PDFFont, opts: FitOptions): FittedBlock {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean)
  let last: FittedBlock | null = null
  for (let size = opts.maxSize; size >= opts.minSize; size -= 1) {
    const lines: string[] = []
    paragraphs.forEach((p, i) => {
      if (i > 0) lines.push('')
      lines.push(...wrapParagraph(p, font, size, opts.maxWidth))
    })
    const height = lines.length * size * opts.lineHeight
    last = { size, lines, height, fits: height <= opts.maxHeight }
    if (last.fits) return last
  }
  return last ?? { size: opts.minSize, lines: [], height: 0, fits: true }
}

// ── Drawing primitives ──────────────────────────────────────────────────────

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = COLORS.oxford) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (PAGE_SIZE - w) / 2, y, size, font, color })
}

/** Upper-case, letter-spaced label (pdf-lib has no tracking, so glyphs are placed one by one). */
export function drawTrackedLabel(page: PDFPage, text: string, font: PDFFont, size: number, y: number, tracking: number, color = COLORS.oxford) {
  const chars = [...text.toUpperCase()]
  const total = chars.reduce((w, c) => w + font.widthOfTextAtSize(c, size), 0) + tracking * (chars.length - 1)
  let x = (PAGE_SIZE - total) / 2
  for (const c of chars) {
    page.drawText(c, { x, y, size, font, color })
    x += font.widthOfTextAtSize(c, size) + tracking
  }
  return total
}

function drawBlock(page: PDFPage, block: FittedBlock, font: PDFFont, centerY: number, lineHeight: number, color: ReturnType<typeof rgb>) {
  const step = block.size * lineHeight
  // First baseline sits so the whole block is vertically centred on centerY.
  let y = centerY + block.height / 2 - block.size
  for (const line of block.lines) {
    if (line) drawCentered(page, line, font, block.size, y, color)
    y -= step
  }
}

/** Double-rule frame with small gold diamonds at the outer corners. */
export function drawFrame(page: PDFPage) {
  const outer = 26
  const inner = 33
  page.drawRectangle({ x: outer, y: outer, width: PAGE_SIZE - outer * 2, height: PAGE_SIZE - outer * 2, borderColor: COLORS.gold, borderWidth: 1.4 })
  page.drawRectangle({ x: inner, y: inner, width: PAGE_SIZE - inner * 2, height: PAGE_SIZE - inner * 2, borderColor: COLORS.goldSoft, borderWidth: 0.6 })
  const d = 5
  for (const [cx, cy] of [[outer, outer], [PAGE_SIZE - outer, outer], [outer, PAGE_SIZE - outer], [PAGE_SIZE - outer, PAGE_SIZE - outer]]) {
    drawDiamond(page, cx, cy, d, COLORS.cream, COLORS.gold)
  }
}

function drawDiamond(page: PDFPage, cx: number, cy: number, r: number, fill: ReturnType<typeof rgb>, stroke: ReturnType<typeof rgb>) {
  // pdf-lib SVG paths are drawn with y pointing down from (x, y).
  page.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x: cx, y: cy, color: fill, borderColor: stroke, borderWidth: 1 })
}

/** Hairline with a diamond at its centre and tapered ends: the page's recurring divider. */
export function drawDivider(page: PDFPage, cy: number, width = 120) {
  const x0 = (PAGE_SIZE - width) / 2
  page.drawLine({ start: { x: x0, y: cy }, end: { x: PAGE_SIZE / 2 - 10, y: cy }, thickness: 0.8, color: COLORS.gold })
  page.drawLine({ start: { x: PAGE_SIZE / 2 + 10, y: cy }, end: { x: x0 + width, y: cy }, thickness: 0.8, color: COLORS.gold })
  drawDiamond(page, PAGE_SIZE / 2, cy, 3.2, COLORS.gold, COLORS.gold)
  page.drawCircle({ x: x0, y: cy, size: 1.3, color: COLORS.gold })
  page.drawCircle({ x: x0 + width, y: cy, size: 1.3, color: COLORS.gold })
}

/** Mirrored leafy flourish flanking a centre gap (used around "The End"). */
export function drawFlourishes(page: PDFPage, cy: number, gapHalf: number, length = 110) {
  // Every path is drawn relative to its own origin so mirroring is just a
  // sign flip; pdf-lib SVG paths have y pointing down from (x, y).
  for (const side of [-1, 1] as const) {
    const start = PAGE_SIZE / 2 + side * gapHalf
    const vine = `M 0 0 C ${side * 30} -6, ${side * (length - 30)} 6, ${side * length} 0`
    page.drawSvgPath(vine, { x: start, y: cy, borderColor: COLORS.gold, borderWidth: 0.9 })
    for (const t of [0.22, 0.52, 0.82]) {
      const leaf = `M 0 0 C ${side * 5} -7, ${side * 12} -7, ${side * 17} 0 C ${side * 12} 5, ${side * 5} 5, 0 0 Z`
      page.drawSvgPath(leaf, { x: start + side * length * t, y: cy + 3, color: COLORS.goldSoft, borderColor: COLORS.gold, borderWidth: 0.6 })
    }
    page.drawCircle({ x: start + side * length, y: cy, size: 1.6, color: COLORS.gold })
  }
}

function drawImageCentered(page: PDFPage, img: PDFImage, width: number, cy: number) {
  const h = (img.height / img.width) * width
  page.drawImage(img, { x: (PAGE_SIZE - width) / 2, y: cy - h / 2, width, height: h })
  return h
}

// ── Pages ────────────────────────────────────────────────────────────────────

export interface Fonts { serif: PDFFont; italic: PDFFont; bold: PDFFont }
export interface Art { mark?: PDFImage; logo?: PDFImage }

export async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  return {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  }
}

export const DEDICATION_FIT: FitOptions = { maxWidth: 400, maxHeight: 230, maxSize: 22, minSize: 13, lineHeight: 1.5 }
export const CLOSING_FIT: FitOptions = { maxWidth: 380, maxHeight: 120, maxSize: 16, minSize: 12, lineHeight: 1.55 }

export interface DedicationPageInput { dedication: string; authorLine: string; lang: Lang }

export function drawDedicationPage(doc: PDFDocument, fonts: Fonts, art: Art, input: DedicationPageInput): FittedBlock {
  const s = STRINGS[input.lang]
  const page = doc.addPage([PAGE_SIZE, PAGE_SIZE])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: COLORS.cream })
  drawFrame(page)

  // Brand mark, then label, then divider — a quiet masthead for the page.
  if (art.mark) drawImageCentered(page, art.mark, 78, 462)
  drawTrackedLabel(page, s.dedication, fonts.serif, 9.5, 410, 3, COLORS.oxford)
  drawDivider(page, 396, 110)

  const text = toWinAnsiSafe(input.dedication)
  const block = fitTextBlock(text, fonts.italic, DEDICATION_FIT)
  drawBlock(page, block, fonts.italic, 262, DEDICATION_FIT.lineHeight, COLORS.charcoal)

  drawDivider(page, 118, 60)
  const author = toWinAnsiSafe(input.authorLine) || 'A Nest & Quill Original'
  drawCentered(page, author, fonts.serif, 9.5, 86, COLORS.gray)
  return block
}

export interface BackPageInput { closingMessage?: string | null; authorLine: string; lang: Lang }

export function drawBackPage(doc: PDFDocument, fonts: Fonts, art: Art, input: BackPageInput): FittedBlock | null {
  const s = STRINGS[input.lang]
  const page = doc.addPage([PAGE_SIZE, PAGE_SIZE])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: COLORS.cream })
  drawFrame(page)

  const closing = toWinAnsiSafe(input.closingMessage)
  const endSize = 34
  // With a closing message the closing line moves up to make room; without one it is the centrepiece.
  const endY = closing ? 402 : 346
  const endW = fonts.italic.widthOfTextAtSize(s.theEnd, endSize)
  drawCentered(page, s.theEnd, fonts.italic, endSize, endY, COLORS.oxford)
  drawFlourishes(page, endY + endSize * 0.32, endW / 2 + 22, 96)

  let block: FittedBlock | null = null
  if (closing) {
    block = fitTextBlock(closing, fonts.italic, CLOSING_FIT)
    drawBlock(page, block, fonts.italic, 300, CLOSING_FIT.lineHeight, COLORS.charcoal)
  }

  drawDivider(page, closing ? 214 : 258, 110)
  const author = toWinAnsiSafe(input.authorLine) || 'A Nest & Quill Original'
  drawCentered(page, author, fonts.serif, 11, closing ? 186 : 230, COLORS.gray)

  // Wordmark colophon: made with love at nestandquill.com
  if (art.logo) drawImageCentered(page, art.logo, 150, 122)
  drawTrackedLabel(page, `${s.madeWith} ${s.site}`, fonts.serif, 8, 58, 1.6, COLORS.stone)
  return block
}
