// Phase 0B prototype — decorative dedication and back pages. VERSION 2.
// (Version 1 is frozen in ./v1 for before/after comparison.)
//
// ISOLATED EXPERIMENT. Nothing in production imports this module; the
// customer PDF export (lib/services/pdf.ts) is untouched. It renders with the
// same technology and dimensions as the real book (pdf-lib, 576 × 576 pt,
// WinAnsi standard fonts) so what you see here is what the production
// renderer could produce without new dependencies.
//
// V2 changes (Founder review of V1): the dedication is larger and anchored
// as a keepsake rather than a certificate (ornament and author line follow
// the text instead of sitting at fixed heights); the back-page logo shrinks
// to a publisher signature and the closing message gains weight; the frame
// becomes one thin rule plus a soft rounded inner line with corner sprigs,
// sparkles and a feather ornament drawn as vectors. Palette unchanged.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib'
import { toWinAnsiSafe } from '../../../lib/services/pdfText.ts'

export const PAGE_SIZE = 576 // 8 × 8 in, identical to lib/services/pdf.ts
const FRAME = 26            // outer rule inset; nothing may be drawn closer to the edge

type Color = ReturnType<typeof rgb>

export const COLORS = {
  cream: rgb(0.973, 0.961, 0.925),   // #F8F5EC
  gold: rgb(0.788, 0.592, 0.0),      // #C99700
  goldSoft: rgb(0.902, 0.831, 0.62), // #E6D49E
  goldPale: rgb(0.955, 0.92, 0.82),  // #F4EBD1
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

/**
 * Where illustration-style-specific decoration could plug in later without
 * changing the page architecture. V2 ships one brand-neutral set; a style
 * (watercolor, cartoon, storybook, pencil_sketch, digital_art) would only
 * swap the drawing routine behind a slot, never positions or typography.
 */
export const ORNAMENT_SLOTS = ['cornerSprig', 'headingFlourish', 'textOrnament', 'sparkles'] as const

// ── Text fitting ─────────────────────────────────────────────────────────────

export interface FitOptions {
  maxWidth: number
  maxHeight: number
  maxSize: number
  minSize: number
  lineHeight: number // multiplier
  paragraphGap?: number // extra multiplier of size between paragraphs (0 = none)
}

export interface FittedBlock {
  size: number
  lines: string[]      // '' marks a paragraph gap
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

/** Height of a fitted block: text lines at lineHeight, paragraph gaps at paragraphGap. */
export function blockHeight(lines: string[], size: number, opts: Pick<FitOptions, 'lineHeight' | 'paragraphGap'>): number {
  const gap = opts.paragraphGap ?? opts.lineHeight
  return lines.reduce((h, l) => h + size * (l === '' ? gap : opts.lineHeight), 0)
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
    const height = blockHeight(lines, size, opts)
    last = { size, lines, height, fits: height <= opts.maxHeight }
    if (last.fits) return last
  }
  return last ?? { size: opts.minSize, lines: [], height: 0, fits: true }
}

// ── Drawing primitives ──────────────────────────────────────────────────────

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: Color = COLORS.oxford) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (PAGE_SIZE - w) / 2, y, size, font, color })
}

/** Upper-case, letter-spaced label (pdf-lib has no tracking, so glyphs are placed one by one). */
export function drawTrackedLabel(page: PDFPage, text: string, font: PDFFont, size: number, y: number, tracking: number, color: Color = COLORS.oxford) {
  const chars = [...text.toUpperCase()]
  const total = chars.reduce((w, c) => w + font.widthOfTextAtSize(c, size), 0) + tracking * (chars.length - 1)
  let x = (PAGE_SIZE - total) / 2
  for (const c of chars) {
    page.drawText(c, { x, y, size, font, color })
    x += font.widthOfTextAtSize(c, size) + tracking
  }
  return total
}

/** Draw a fitted block with its top edge at `topY`; returns the y of the last baseline. */
function drawBlockFromTop(page: PDFPage, block: FittedBlock, font: PDFFont, topY: number, opts: Pick<FitOptions, 'lineHeight' | 'paragraphGap'>, color: Color) {
  const gap = opts.paragraphGap ?? opts.lineHeight
  let y = topY - block.size
  let lastBaseline = y
  for (const line of block.lines) {
    if (line) { drawCentered(page, line, font, block.size, y, color); lastBaseline = y; y -= block.size * opts.lineHeight }
    else y -= block.size * gap
  }
  return lastBaseline
}

/** V2 frame: one thin gold rule, a soft rounded inner line, and a leaf sprig in each corner. */
export function drawFrame(page: PDFPage) {
  page.drawRectangle({ x: FRAME, y: FRAME, width: PAGE_SIZE - FRAME * 2, height: PAGE_SIZE - FRAME * 2, borderColor: COLORS.gold, borderWidth: 1.1 })
  const i = FRAME + 8
  const w = PAGE_SIZE - i * 2
  const r = 14
  // Rounded inner line (SVG y points down from the given origin, so start at the top-left).
  const rounded = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${w} H ${r} A ${r} ${r} 0 0 1 0 ${w - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
  page.drawSvgPath(rounded, { x: i, y: PAGE_SIZE - i, borderColor: COLORS.goldSoft, borderWidth: 0.6 })
  const c = FRAME + 18
  drawCornerSprig(page, c, c, 1, 1)
  drawCornerSprig(page, PAGE_SIZE - c, c, -1, 1)
  drawCornerSprig(page, c, PAGE_SIZE - c, 1, -1)
  drawCornerSprig(page, PAGE_SIZE - c, PAGE_SIZE - c, -1, -1)
}

/** Three-leaf sprig growing diagonally out of a corner. sx/sy are the inward directions. */
export function drawCornerSprig(page: PDFPage, x: number, y: number, sx: 1 | -1, sy: 1 | -1) {
  // SVG coordinates: +x right, +y DOWN. sy = +1 means "inward is up on the page" → SVG -y.
  const dx = sx, dy = -sy
  const stem = `M 0 0 Q ${8 * dx} ${8 * dy} ${20 * dx} ${20 * dy}`
  page.drawSvgPath(stem, { x, y, borderColor: COLORS.gold, borderWidth: 0.7 })
  const leaf = (lx: number, ly: number, ax: number, ay: number) =>
    `M ${lx} ${ly} C ${lx + ax * 5 - ay * 3} ${ly + ay * 5 + ax * 3}, ${lx + ax * 9 - ay * 2} ${ly + ay * 9 + ax * 2}, ${lx + ax * 12} ${ly + ay * 12} C ${lx + ax * 9 + ay * 2} ${ly + ay * 9 - ax * 2}, ${lx + ax * 5 + ay * 3} ${ly + ay * 5 - ax * 3}, ${lx} ${ly} Z`
  // Tip leaf along the stem, two side leaves branching off.
  page.drawSvgPath(leaf(20 * dx, 20 * dy, 0.7 * dx, 0.7 * dy), { x, y, color: COLORS.goldSoft, borderColor: COLORS.gold, borderWidth: 0.5 })
  page.drawSvgPath(leaf(9 * dx, 9 * dy, 0.95 * dx, 0.1 * dy), { x, y, color: COLORS.goldPale, borderColor: COLORS.gold, borderWidth: 0.5 })
  page.drawSvgPath(leaf(9 * dx, 9 * dy, 0.1 * dx, 0.95 * dy), { x, y, color: COLORS.goldPale, borderColor: COLORS.gold, borderWidth: 0.5 })
}

function drawDiamond(page: PDFPage, cx: number, cy: number, r: number, fill: Color, stroke: Color) {
  page.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x: cx, y: cy, color: fill, borderColor: stroke, borderWidth: 1 })
}

/** Hairline with a diamond at its centre and dotted ends: the recurring divider. */
export function drawDivider(page: PDFPage, cy: number, width = 120) {
  const x0 = (PAGE_SIZE - width) / 2
  page.drawLine({ start: { x: x0, y: cy }, end: { x: PAGE_SIZE / 2 - 10, y: cy }, thickness: 0.8, color: COLORS.gold })
  page.drawLine({ start: { x: PAGE_SIZE / 2 + 10, y: cy }, end: { x: x0 + width, y: cy }, thickness: 0.8, color: COLORS.gold })
  drawDiamond(page, PAGE_SIZE / 2, cy, 3.2, COLORS.gold, COLORS.gold)
  page.drawCircle({ x: x0, y: cy, size: 1.3, color: COLORS.gold })
  page.drawCircle({ x: x0 + width, y: cy, size: 1.3, color: COLORS.gold })
}

/** Four-point sparkle star. */
export function drawSparkle(page: PDFPage, cx: number, cy: number, r: number, color: Color = COLORS.gold) {
  const k = r * 0.28
  page.drawSvgPath(`M 0 ${-r} Q ${k} ${-k} ${r} 0 Q ${k} ${k} 0 ${r} Q ${-k} ${k} ${-r} 0 Q ${-k} ${-k} 0 ${-r} Z`, { x: cx, y: cy, color })
}

/** Mirrored vine-and-leaf flourish flanking a centre gap (used around "The End"), with a sparkle at each tip. */
export function drawFlourishes(page: PDFPage, cy: number, gapHalf: number, length = 110) {
  for (const side of [-1, 1] as const) {
    const start = PAGE_SIZE / 2 + side * gapHalf
    const vine = `M 0 0 C ${side * 30} -7, ${side * (length - 30)} 7, ${side * length} -2`
    page.drawSvgPath(vine, { x: start, y: cy, borderColor: COLORS.gold, borderWidth: 0.9 })
    for (const [t, up] of [[0.2, -1], [0.45, 1], [0.7, -1]] as const) {
      // Leaves alternate above/below the vine and lean toward the tip.
      const leaf = `M 0 0 C ${side * 4} ${up * 8}, ${side * 11} ${up * 10}, ${side * 16} ${up * 3} C ${side * 11} ${up * 4}, ${side * 5} ${up * 1}, 0 0 Z`
      page.drawSvgPath(leaf, { x: start + side * length * t, y: cy + (t === 0.45 ? -1 : 1), color: COLORS.goldSoft, borderColor: COLORS.gold, borderWidth: 0.6 })
    }
    drawSparkle(page, start + side * (length + 6), cy + 2, 4.5)
  }
}

/** Small horizontal quill drawn with vectors; `width` is the span of the spine. */
export function drawFeather(page: PDFPage, cx: number, cy: number, width = 72) {
  const w = width
  const x0 = cx - w / 2
  // Vane (closed), then spine, then a few barb lines. SVG y points down.
  const vane = `M 0 0 C ${w * 0.25} ${-w * 0.16}, ${w * 0.6} ${-w * 0.22}, ${w} ${-w * 0.18} C ${w * 0.7} ${-w * 0.04}, ${w * 0.4} ${w * 0.03}, ${w * 0.12} 0 Z`
  page.drawSvgPath(vane, { x: x0, y: cy, color: COLORS.goldPale, borderColor: COLORS.gold, borderWidth: 0.7 })
  page.drawSvgPath(`M ${-w * 0.08} ${w * 0.03} Q ${w * 0.4} ${-w * 0.06} ${w} ${-w * 0.18}`, { x: x0, y: cy, borderColor: COLORS.gold, borderWidth: 0.8 })
  for (const t of [0.3, 0.45, 0.6, 0.75]) {
    const bx = w * t
    const by = -w * 0.06 * (t / 0.5)
    page.drawSvgPath(`M ${bx} ${by} q ${w * 0.05} ${-w * 0.07} ${w * 0.12} ${-w * 0.1}`, { x: x0, y: cy, borderColor: COLORS.gold, borderWidth: 0.45 })
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

// Dedication: one or two lines read at 24 pt; a full 300-character text steps
// down to 15–16 pt. The column is 410 pt (83 pt side margins inside the frame).
export const DEDICATION_FIT: FitOptions = { maxWidth: 410, maxHeight: 236, maxSize: 24, minSize: 14, lineHeight: 1.45, paragraphGap: 0.9 }
// Closing message: promoted from 16 → 18 pt max; 200 characters fit at 17–18 pt.
export const CLOSING_FIT: FitOptions = { maxWidth: 392, maxHeight: 118, maxSize: 18, minSize: 12, lineHeight: 1.5, paragraphGap: 0.8 }

/** Vertical plan of the dedication page for a fitted block (pure; tested for overflow). */
export interface DedicationLayout { markCy: number; labelY: number; dividerY: number; textTop: number; textBottom: number; featherY: number; authorY: number }

export function dedicationLayout(block: FittedBlock): DedicationLayout {
  const markCy = 466
  const labelY = 414
  const dividerY = 401
  // Text region 150 … 372 (centre 261). Shorter blocks float slightly above
  // centre, which reads as intentional rather than lost in the page.
  const regionTop = 372
  const regionBottom = 150
  const centre = (regionTop + regionBottom) / 2 + Math.max(0, (regionTop - regionBottom - block.height) * 0.08)
  const textTop = Math.min(regionTop, centre + block.height / 2)
  const textBottom = textTop - block.height
  // The feather and author line follow the text so short dedications close up.
  const featherY = Math.max(96, textBottom - 36)
  const authorY = featherY - 34
  return { markCy, labelY, dividerY, textTop, textBottom, featherY, authorY }
}

export interface DedicationPageInput { dedication: string; authorLine: string; lang: Lang }

export function drawDedicationPage(doc: PDFDocument, fonts: Fonts, art: Art, input: DedicationPageInput): FittedBlock {
  const s = STRINGS[input.lang]
  const page = doc.addPage([PAGE_SIZE, PAGE_SIZE])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: COLORS.cream })
  drawFrame(page)

  const text = toWinAnsiSafe(input.dedication)
  const block = fitTextBlock(text, fonts.italic, DEDICATION_FIT)
  const L = dedicationLayout(block)

  // Masthead: mark with two small sparkles, label, divider.
  if (art.mark) drawImageCentered(page, art.mark, 66, L.markCy)
  drawSparkle(page, PAGE_SIZE / 2 - 58, L.markCy + 14, 4, COLORS.goldSoft)
  drawSparkle(page, PAGE_SIZE / 2 + 56, L.markCy - 10, 3, COLORS.goldSoft)
  drawTrackedLabel(page, s.dedication, fonts.serif, 9.5, L.labelY, 3.2, COLORS.oxford)
  drawDivider(page, L.dividerY, 96)

  drawBlockFromTop(page, block, fonts.italic, L.textTop, DEDICATION_FIT, COLORS.charcoal)

  drawFeather(page, PAGE_SIZE / 2, L.featherY, 70)
  const author = toWinAnsiSafe(input.authorLine) || 'A Nest & Quill Original'
  drawCentered(page, author, fonts.serif, 10, L.authorY, COLORS.gray)
  return block
}

export interface BackLayout { endY: number; endSize: number; closingTop: number | null; dividerY: number; authorY: number; logoCy: number; logoWidth: number; siteY: number }

export function backLayout(block: FittedBlock | null): BackLayout {
  const endSize = 36
  if (block) {
    // Heading, then the message sits close beneath it as one reading unit.
    const endY = 412
    const closingTop = endY - 42
    const closingBottom = closingTop - block.height
    const dividerY = Math.max(176, closingBottom - 30)
    return { endY, endSize, closingTop, dividerY, authorY: dividerY - 26, logoCy: 122, logoWidth: 96, siteY: 58 }
  }
  // Without a message the heading becomes the centrepiece and everything
  // below is spaced evenly down to the signature.
  return { endY: 330, endSize, closingTop: null, dividerY: 268, authorY: 242, logoCy: 128, logoWidth: 96, siteY: 58 }
}

export interface BackPageInput { closingMessage?: string | null; authorLine: string; lang: Lang }

export function drawBackPage(doc: PDFDocument, fonts: Fonts, art: Art, input: BackPageInput): FittedBlock | null {
  const s = STRINGS[input.lang]
  const page = doc.addPage([PAGE_SIZE, PAGE_SIZE])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: COLORS.cream })
  drawFrame(page)

  const closing = toWinAnsiSafe(input.closingMessage)
  const block = closing ? fitTextBlock(closing, fonts.italic, CLOSING_FIT) : null
  const L = backLayout(block)

  const endW = fonts.italic.widthOfTextAtSize(s.theEnd, L.endSize)
  drawCentered(page, s.theEnd, fonts.italic, L.endSize, L.endY, COLORS.oxford)
  drawFlourishes(page, L.endY + L.endSize * 0.3, endW / 2 + 24, 92)

  if (block && L.closingTop !== null) drawBlockFromTop(page, block, fonts.italic, L.closingTop, CLOSING_FIT, COLORS.charcoal)

  drawDivider(page, L.dividerY, 96)
  const author = toWinAnsiSafe(input.authorLine) || 'A Nest & Quill Original'
  drawCentered(page, author, fonts.serif, 10.5, L.authorY, COLORS.gray)

  // Publisher signature: small wordmark and the site line.
  if (art.logo) drawImageCentered(page, art.logo, L.logoWidth, L.logoCy)
  drawTrackedLabel(page, `${s.madeWith} ${s.site}`, fonts.serif, 7.5, L.siteY, 1.5, COLORS.stone)
  return block
}
