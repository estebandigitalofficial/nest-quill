import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { assembleBook } from '@/lib/writer/assembleBook'
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

export const maxDuration = 60

const MARGIN = 72        // 1 inch
const BODY_SIZE = 12
const HEADING_SIZE = 20
const SUBHEADING_SIZE = 14
const SMALL_SIZE = 10
const LINE_HEIGHT = BODY_SIZE * 1.75
const PAGE_W = PageSizes.Letter[0]
const PAGE_H = PageSizes.Letter[1]
const TEXT_W = PAGE_W - MARGIN * 2
const BLACK = rgb(0, 0, 0)
const GRAY = rgb(0.4, 0.4, 0.4)

type Fonts = {
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>
  italic: Awaited<ReturnType<PDFDocument['embedFont']>>
}

function wrapLines(text: string, font: Fonts['regular'], size: number, maxW: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxW) { line = test }
    else { if (line) lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

class Renderer {
  doc: PDFDocument
  fonts: Fonts
  page!: ReturnType<PDFDocument['addPage']>
  y!: number
  pageNum = 0

  constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc
    this.fonts = fonts
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage(PageSizes.Letter)
    this.y = PAGE_H - MARGIN
    this.pageNum++
    // Page number (skip title page = page 1)
    if (this.pageNum > 1) {
      this.page.drawText(String(this.pageNum - 1), {
        x: PAGE_W / 2 - 6, y: MARGIN / 2,
        size: SMALL_SIZE, font: this.fonts.regular, color: GRAY,
      })
    }
  }

  need(h: number) { if (this.y - h < MARGIN + 20) this.newPage() }

  drawLine(text: string, font: Fonts['regular'], size: number, x: number, color = BLACK) {
    this.page.drawText(text, { x, y: this.y, size, font, color })
    this.y -= size * 1.75
  }

  centered(text: string, font: Fonts['regular'], size: number, color = BLACK) {
    const w = font.widthOfTextAtSize(text, size)
    this.need(size * 2)
    this.page.drawText(text, { x: (PAGE_W - w) / 2, y: this.y, size, font, color })
    this.y -= size * 1.75
  }

  paragraph(text: string, indent = true) {
    const lines = wrapLines(text, this.fonts.regular, BODY_SIZE, TEXT_W)
    lines.forEach((line, i) => {
      this.need(LINE_HEIGHT)
      this.page.drawText(line, {
        x: MARGIN + (i === 0 && indent ? 28 : 0),
        y: this.y, size: BODY_SIZE, font: this.fonts.regular, color: BLACK,
      })
      this.y -= LINE_HEIGHT
    })
    this.y -= LINE_HEIGHT * 0.15
  }

  textBlock(content: string, firstNoIndent = true) {
    content.split(/\n\n+/).filter(p => p.trim()).forEach((para, i) => {
      this.paragraph(para.trim(), !(i === 0 && firstNoIndent))
    })
  }

  sectionTitle(label: string) {
    this.newPage()
    this.y = PAGE_H / 2 + 40
    this.centered(label.toUpperCase(), this.fonts.bold, SUBHEADING_SIZE)
    this.y = PAGE_H / 2 - 40
  }

  chapterTitle(number: number, title: string) {
    this.newPage()
    this.y = PAGE_H - MARGIN - 60
    this.centered(`Chapter ${number}`, this.fonts.regular, SUBHEADING_SIZE, GRAY)
    this.y -= 8
    this.centered(title, this.fonts.bold, HEADING_SIZE)
    this.y -= 32
  }

  sceneBreak() {
    this.need(LINE_HEIGHT * 3)
    this.y -= LINE_HEIGHT
    const sym = '✦   ✦   ✦'
    const w = this.fonts.regular.widthOfTextAtSize(sym, SMALL_SIZE)
    this.page.drawText(sym, { x: (PAGE_W - w) / 2, y: this.y, size: SMALL_SIZE, font: this.fonts.regular, color: GRAY })
    this.y -= LINE_HEIGHT * 1.5
  }

  tocEntry(label: string, pageNum: number) {
    this.need(LINE_HEIGHT)
    const numStr = String(pageNum)
    const numW = this.fonts.regular.widthOfTextAtSize(numStr, BODY_SIZE)
    const maxLabelW = TEXT_W - numW - 20
    const labelLines = wrapLines(label, this.fonts.regular, BODY_SIZE, maxLabelW)
    // Dots
    const dotsW = TEXT_W - this.fonts.regular.widthOfTextAtSize(labelLines[0], BODY_SIZE) - numW - 10
    const dot = '.'
    const dotW = this.fonts.regular.widthOfTextAtSize(dot, BODY_SIZE)
    const dotCount = Math.max(3, Math.floor(dotsW / dotW))
    this.page.drawText(labelLines[0], { x: MARGIN, y: this.y, size: BODY_SIZE, font: this.fonts.regular, color: BLACK })
    this.page.drawText('.'.repeat(dotCount), { x: MARGIN + this.fonts.regular.widthOfTextAtSize(labelLines[0], BODY_SIZE) + 6, y: this.y, size: BODY_SIZE, font: this.fonts.regular, color: GRAY })
    this.page.drawText(numStr, { x: MARGIN + TEXT_W - numW, y: this.y, size: BODY_SIZE, font: this.fonts.regular, color: BLACK })
    this.y -= LINE_HEIGHT
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  let ctx
  try { ctx = await requireAdmin() } catch { return adminGuardResponse() }

  const { bookId } = await params
  if (!await checkBookOwner(bookId, ctx)) return adminGuardResponse()

  const url = new URL(req.url)
  const book = await assembleBook(bookId, {
    includeFrontMatter: url.searchParams.get('frontMatter') !== 'false',
    includeBackMatter: url.searchParams.get('backMatter') !== 'false',
    includeCopyright: url.searchParams.get('copyright') !== 'false',
  })

  const pdfDoc = await PDFDocument.create()
  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    italic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
  }
  const r = new Renderer(pdfDoc, fonts)

  // 1. Title page
  r.y = PAGE_H / 2 + 80
  r.centered(book.title, fonts.bold, 28)
  if (book.subtitle) { r.y -= 8; r.centered(book.subtitle, fonts.italic, 16, GRAY) }
  r.y -= 40
  r.centered(book.authorName, fonts.regular, 14)
  if (book.publisher) { r.y -= 8; r.centered(book.publisher, fonts.regular, SMALL_SIZE, GRAY) }
  if (book.year) { r.y -= 4; r.centered(book.year, fonts.regular, SMALL_SIZE, GRAY) }

  // 2. Copyright
  if (book.copyrightText) {
    r.newPage()
    r.y = MARGIN + 280
    for (const line of book.copyrightText.split('\n')) {
      r.need(LINE_HEIGHT)
      r.page.drawText(line || ' ', { x: MARGIN, y: r.y, size: SMALL_SIZE, font: fonts.regular, color: GRAY })
      r.y -= SMALL_SIZE * 1.6
    }
  }

  // 3. Pre-TOC (dedication, epigraph)
  for (const s of book.preTocSections) {
    r.newPage()
    if (s.type === 'epigraph') {
      r.y = PAGE_H / 2 + 40
      s.content.split(/\n\n+/).filter(p => p.trim()).forEach(para => {
        r.centered(para.trim(), fonts.italic, BODY_SIZE, GRAY)
      })
    } else {
      r.sectionTitle(s.label)
      r.textBlock(s.content)
    }
  }

  // 4. Table of Contents
  // We need to track page numbers — estimate based on content
  // Build a TOC page with chapter listings
  const tocPageNum = r.pageNum + 1
  r.newPage()
  r.y = PAGE_H - MARGIN - 20
  r.centered('CONTENTS', fonts.bold, SUBHEADING_SIZE)
  r.y -= 20

  // Estimate page numbers (rough: 300 words per page)
  let estimatedPage = tocPageNum + 1 + book.postTocSections.length
  const tocRows: { label: string; page: number }[] = []

  for (const s of book.postTocSections) {
    tocRows.push({ label: s.label, page: estimatedPage })
    const words = s.content.split(/\s+/).length
    estimatedPage += Math.max(1, Math.ceil(words / 300))
  }
  for (const ch of book.chapters) {
    tocRows.push({ label: `Chapter ${ch.number}: ${ch.title}`, page: estimatedPage })
    const words = ch.content.split(/\s+/).length
    estimatedPage += Math.max(1, Math.ceil(words / 300))
  }
  for (const s of book.backMatter) {
    tocRows.push({ label: s.label, page: estimatedPage })
    const words = s.content.split(/\s+/).length
    estimatedPage += Math.max(1, Math.ceil(words / 300))
  }

  for (const row of tocRows) r.tocEntry(row.label, row.page)

  // 5. Post-TOC front matter
  for (const s of book.postTocSections) {
    r.sectionTitle(s.label)
    r.textBlock(s.content)
  }

  // 6. Chapters
  for (const ch of book.chapters) {
    r.chapterTitle(ch.number, ch.title)
    const scenes = ch.content.split(/\n\n(?=[A-Z])/)
    scenes.forEach((scene, i) => {
      if (i > 0) r.sceneBreak()
      r.textBlock(scene, i === 0)
    })
  }

  // 7. Back matter
  for (const s of book.backMatter) {
    r.sectionTitle(s.label)
    r.textBlock(s.content)
  }

  const pdfBytes = await pdfDoc.save()
  const slug = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  return new NextResponse(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}.pdf"`,
    },
  })
}
