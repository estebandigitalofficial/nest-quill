import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { assembleBook } from '@/lib/writer/assembleBook'
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

export const maxDuration = 60

const MARGIN = 72 // 1 inch
const FONT_SIZE = 12
const HEADING_SIZE = 18
const LINE_HEIGHT = FONT_SIZE * 1.6
const PAGE_WIDTH = PageSizes.Letter[0]
const PAGE_HEIGHT = PageSizes.Letter[1]
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2

function wrapText(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
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
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)

  let page = pdfDoc.addPage(PageSizes.Letter)
  let y = PAGE_HEIGHT - MARGIN

  function newPage() {
    page = pdfDoc.addPage(PageSizes.Letter)
    y = PAGE_HEIGHT - MARGIN
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage()
  }

  function drawText(text: string, options: { size?: number; bold?: boolean; italic?: boolean; centered?: boolean; color?: [number, number, number] } = {}) {
    const { size = FONT_SIZE, bold = false, italic = false, centered = false } = options
    const f = bold ? boldFont : italic ? italicFont : font
    const lines = wrapText(text, f, size, MAX_WIDTH)
    for (const line of lines) {
      ensureSpace(size * 1.6)
      const x = centered
        ? (PAGE_WIDTH - f.widthOfTextAtSize(line, size)) / 2
        : MARGIN
      page.drawText(line, { x, y, size, font: f, color: rgb(0, 0, 0) })
      y -= size * 1.6
    }
  }

  function drawParagraph(text: string) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
    for (const para of paragraphs) {
      ensureSpace(LINE_HEIGHT * 2)
      // First line indent
      const words = para.replace(/\n/g, ' ').trim().split(' ')
      const indentWidth = font.widthOfTextAtSize('    ', FONT_SIZE)
      const lines = wrapText(words.join(' '), font, FONT_SIZE, MAX_WIDTH - indentWidth)
      lines.forEach((line, i) => {
        ensureSpace(LINE_HEIGHT)
        page.drawText(line, {
          x: i === 0 ? MARGIN + indentWidth : MARGIN,
          y, size: FONT_SIZE, font, color: rgb(0, 0, 0),
        })
        y -= LINE_HEIGHT
      })
      y -= LINE_HEIGHT * 0.4
    }
  }

  function drawHeading(text: string) {
    y -= HEADING_SIZE
    ensureSpace(HEADING_SIZE * 2)
    drawText(text, { size: HEADING_SIZE, bold: true })
    y -= HEADING_SIZE * 0.5
  }

  // Title page
  y = PAGE_HEIGHT / 2 + 60
  drawText(book.title, { size: 28, bold: true, centered: true })
  if (book.subtitle) {
    y -= 10
    drawText(book.subtitle, { size: 16, italic: true, centered: true })
  }
  y -= 20
  drawText(book.authorName, { size: 14, centered: true })

  // Copyright
  if (book.copyrightText) {
    newPage()
    y = MARGIN + 200
    for (const line of book.copyrightText.split('\n')) {
      drawText(line || ' ', { size: 10 })
    }
  }

  // Front matter
  for (const section of book.frontMatter) {
    newPage()
    drawHeading(section.label)
    drawParagraph(section.content)
  }

  // Chapters
  for (const ch of book.chapters) {
    newPage()
    drawHeading(`Chapter ${ch.number}: ${ch.title}`)
    drawParagraph(ch.content)
  }

  // Back matter
  for (const section of book.backMatter) {
    newPage()
    drawHeading(section.label)
    drawParagraph(section.content)
  }

  const pdfBytes = await pdfDoc.save()
  const slug = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}.pdf"`,
    },
  })
}
