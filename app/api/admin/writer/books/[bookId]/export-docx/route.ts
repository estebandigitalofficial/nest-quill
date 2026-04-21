import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { assembleBook } from '@/lib/writer/assembleBook'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, convertInchesToTwip,
} from 'docx'

export const maxDuration = 60

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

  const sections: Paragraph[] = []

  function heading1(text: string): Paragraph {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: convertInchesToTwip(1), after: convertInchesToTwip(0.3) },
    })
  }

  function heading2(text: string): Paragraph {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: convertInchesToTwip(0.5), after: convertInchesToTwip(0.2) },
    })
  }

  function bodyPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, size: 24 })],
      spacing: { after: 160 },
      indent: { firstLine: convertInchesToTwip(0.5) },
    })
  }

  function pageBreak(): Paragraph {
    return new Paragraph({ children: [new PageBreak()] })
  }

  function textBlock(content: string): Paragraph[] {
    return content.split(/\n\n+/).filter(p => p.trim()).map(p => bodyPara(p.trim()))
  }

  // Title page
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: book.title, bold: true, size: 52 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(2), after: convertInchesToTwip(0.3) },
    })
  )
  if (book.subtitle) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: book.subtitle, italics: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertInchesToTwip(0.5) },
    }))
  }
  sections.push(new Paragraph({
    children: [new TextRun({ text: book.authorName, size: 28 })],
    alignment: AlignmentType.CENTER,
  }))
  sections.push(pageBreak())

  // Copyright
  if (book.copyrightText) {
    sections.push(...book.copyrightText.split('\n').map(line =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 18 })],
        spacing: { after: 80 },
      })
    ))
    sections.push(pageBreak())
  }

  // Front matter
  for (const section of book.frontMatter) {
    sections.push(heading1(section.label))
    sections.push(...textBlock(section.content))
    sections.push(pageBreak())
  }

  // Chapters
  for (const ch of book.chapters) {
    sections.push(heading1(`Chapter ${ch.number}: ${ch.title}`))
    sections.push(...textBlock(ch.content))
    sections.push(pageBreak())
  }

  // Back matter
  for (const section of book.backMatter) {
    sections.push(heading1(section.label))
    sections.push(...textBlock(section.content))
    sections.push(pageBreak())
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1.25),
          },
        },
      },
      children: sections,
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const slug = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${slug}.docx"`,
    },
  })
}
