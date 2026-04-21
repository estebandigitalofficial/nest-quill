import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, checkBookOwner, adminGuardResponse } from '@/lib/admin/guard'
import { assembleBook } from '@/lib/writer/assembleBook'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, convertInchesToTwip, TabStopPosition,
  TabStopType, LeaderType,
} from 'docx'

export const maxDuration = 60

const MARGINS = {
  top: convertInchesToTwip(1),
  bottom: convertInchesToTwip(1),
  left: convertInchesToTwip(1.25),
  right: convertInchesToTwip(1.25),
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

function bodyPara(text: string, noIndent = false) {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, font: 'Times New Roman' })],
    spacing: { after: 0, line: 360 },
    indent: noIndent ? undefined : { firstLine: convertInchesToTwip(0.5) },
  })
}

function textBlock(content: string): Paragraph[] {
  return content.split(/\n\n+/).filter(p => p.trim()).map((p, i) =>
    bodyPara(p.trim(), i === 0)
  )
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 28, font: 'Times New Roman' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: convertInchesToTwip(2), after: convertInchesToTwip(0.5) },
  })
}

function chapterHeading(number: number, title: string): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: `Chapter ${number}`, size: 26, color: '888888', font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(1.5), after: convertInchesToTwip(0.2) },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32, font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: convertInchesToTwip(0.6) },
    }),
  ]
}

function sceneBreak(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '✦   ✦   ✦', size: 20, color: '888888' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: convertInchesToTwip(0.4), after: convertInchesToTwip(0.4) },
  })
}

function tocEntry(label: string, pageNum: number): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: label, size: 24, font: 'Times New Roman' }),
      new TextRun({ text: `\t${pageNum}`, size: 24, font: 'Times New Roman' }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: LeaderType.DOT }],
    spacing: { after: 80 },
  })
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

  const children: Paragraph[] = []

  // 1. Title page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: book.title, bold: true, size: 56, font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(2.5), after: convertInchesToTwip(0.3) },
    })
  )
  if (book.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: book.subtitle, italics: true, size: 32, font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: convertInchesToTwip(0.5) },
    }))
  }
  children.push(new Paragraph({
    children: [new TextRun({ text: book.authorName, size: 28, font: 'Times New Roman' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: convertInchesToTwip(0.3) },
  }))
  if (book.publisher) {
    children.push(new Paragraph({
      children: [new TextRun({ text: book.publisher, size: 20, color: '888888', font: 'Times New Roman' })],
      alignment: AlignmentType.CENTER,
    }))
  }
  children.push(pageBreak())

  // 2. Copyright
  if (book.copyrightText) {
    for (const line of book.copyrightText.split('\n')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line || ' ', size: 18, color: '555555', font: 'Times New Roman' })],
        spacing: { after: 60 },
      }))
    }
    children.push(pageBreak())
  }

  // 3. Pre-TOC (dedication, epigraph)
  for (const s of book.preTocSections) {
    if (s.type !== 'epigraph') children.push(sectionHeading(s.label))
    children.push(...textBlock(s.content))
    children.push(pageBreak())
  }

  // 4. Table of Contents
  children.push(sectionHeading('Contents'))
  let estimatedPage = 4 + book.preTocSections.length + book.postTocSections.length
  for (const s of book.postTocSections) {
    children.push(tocEntry(s.label, estimatedPage))
    estimatedPage += Math.max(1, Math.ceil(s.content.split(/\s+/).length / 300))
  }
  for (const ch of book.chapters) {
    children.push(tocEntry(`Chapter ${ch.number}: ${ch.title}`, estimatedPage))
    estimatedPage += Math.max(1, Math.ceil(ch.content.split(/\s+/).length / 300))
  }
  for (const s of book.backMatter) {
    children.push(tocEntry(s.label, estimatedPage))
    estimatedPage += Math.max(1, Math.ceil(s.content.split(/\s+/).length / 300))
  }
  children.push(pageBreak())

  // 5. Post-TOC front matter
  for (const s of book.postTocSections) {
    children.push(sectionHeading(s.label))
    children.push(...textBlock(s.content))
    children.push(pageBreak())
  }

  // 6. Chapters
  for (const ch of book.chapters) {
    children.push(...chapterHeading(ch.number, ch.title))
    const scenes = ch.content.split(/\n\n(?=[A-Z])/)
    scenes.forEach((scene, i) => {
      if (i > 0) children.push(sceneBreak())
      children.push(...textBlock(scene))
    })
    children.push(pageBreak())
  }

  // 7. Back matter
  for (const s of book.backMatter) {
    children.push(sectionHeading(s.label))
    children.push(...textBlock(s.content))
    children.push(pageBreak())
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: MARGINS } },
      children,
    }],
  })

  const b64 = await Packer.toBase64String(doc)
  const buf = Buffer.from(b64, 'base64')
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const slug = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${slug}.docx"`,
    },
  })
}
