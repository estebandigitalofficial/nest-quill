import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { GeneratedStory, StoryScene } from '@/types/database'

// 8 × 8 inch square — standard picture-book format
const PAGE_SIZE = 576 // points
const MARGIN = 40
const BRAND_GOLD = rgb(0.788, 0.592, 0.0)     // #C99700
const CREAM = rgb(0.973, 0.961, 0.925)        // #F8F5EC
const OXFORD = rgb(0.047, 0.137, 0.251)       // #0C2340
const CHARCOAL = rgb(0.18, 0.18, 0.18)        // #2E2E2E
const GRAY = rgb(0.471, 0.443, 0.424)         // #78716c

export interface PDFGenerationInput {
  story: GeneratedStory
  scenes: StoryScene[]
  // Caller fetches signed URLs from Supabase; pass null for pages without images
  signedImageUrls: Map<number, string>
}

export interface PDFGenerationResult {
  buffer: Buffer
  pageCount: number
  renderTimeMs: number
}

export async function generateBookPDF(input: PDFGenerationInput): Promise<PDFGenerationResult> {
  const t0 = Date.now()
  const { story, scenes, signedImageUrls } = input

  const doc = await PDFDocument.create()
  const fontSerif = await doc.embedFont(StandardFonts.TimesRoman)
  const fontSerifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fontSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold)

  // Download and embed images ahead of time
  const embeddedImages = new Map<number, Awaited<ReturnType<typeof doc.embedPng>>>()
  for (const [pageNum, url] of signedImageUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const bytes = new Uint8Array(await res.arrayBuffer())
      const image = await doc.embedPng(bytes).catch(() => doc.embedJpg(bytes))
      embeddedImages.set(pageNum, image)
    } catch {
      // Skip failed images — page will render without illustration
    }
  }

  // ── Cover page ─────────────────────────────────────────────────────────────
  const cover = doc.addPage([PAGE_SIZE, PAGE_SIZE])
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: CREAM })

  // Decorative top bar
  cover.drawRectangle({ x: 0, y: PAGE_SIZE - 8, width: PAGE_SIZE, height: 8, color: BRAND_GOLD })

  const titleSize = story.title.length > 24 ? 28 : 34
  const titleLines = wrapText(story.title, fontSerifBold, titleSize, PAGE_SIZE - MARGIN * 2)
  let coverY = PAGE_SIZE * 0.62
  for (const line of titleLines) {
    const w = fontSerifBold.widthOfTextAtSize(line, titleSize)
    cover.drawText(line, { x: (PAGE_SIZE - w) / 2, y: coverY, size: titleSize, font: fontSerifBold, color: OXFORD })
    coverY -= titleSize * 1.3
  }

  if (story.subtitle) {
    coverY -= 6
    const subtitleLines = wrapText(story.subtitle, fontSerifItalic, 16, PAGE_SIZE - MARGIN * 2)
    for (const line of subtitleLines) {
      const w = fontSerifItalic.widthOfTextAtSize(line, 16)
      cover.drawText(line, { x: (PAGE_SIZE - w) / 2, y: coverY, size: 16, font: fontSerifItalic, color: GRAY })
      coverY -= 16 * 1.4
    }
  }

  // Author line
  const authorText = story.author_line ?? 'A Nest & Quill Original'
  const authorW = fontSerif.widthOfTextAtSize(authorText, 11)
  cover.drawText(authorText, {
    x: (PAGE_SIZE - authorW) / 2,
    y: MARGIN + 10,
    size: 11,
    font: fontSerif,
    color: GRAY,
  })

  // Decorative bottom bar
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: 8, color: BRAND_GOLD })

  // ── Dedication page ────────────────────────────────────────────────────────
  if (story.dedication) {
    const dedPage = doc.addPage([PAGE_SIZE, PAGE_SIZE])
    dedPage.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: CREAM })

    const dedLines = wrapText(story.dedication, fontSerifItalic, 14, PAGE_SIZE - MARGIN * 4)
    const dedBlockH = dedLines.length * 14 * 1.6
    let dedY = PAGE_SIZE / 2 + dedBlockH / 2

    for (const line of dedLines) {
      const w = fontSerifItalic.widthOfTextAtSize(line, 14)
      dedPage.drawText(line, { x: (PAGE_SIZE - w) / 2, y: dedY, size: 14, font: fontSerifItalic, color: GRAY })
      dedY -= 14 * 1.6
    }
  }

  // ── Story pages ────────────────────────────────────────────────────────────
  const sortedScenes = [...scenes].sort((a, b) => a.page_number - b.page_number)

  for (const scene of sortedScenes) {
    const storyPage = doc.addPage([PAGE_SIZE, PAGE_SIZE])
    storyPage.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: CREAM })

    const embeddedImg = embeddedImages.get(scene.page_number)

    if (embeddedImg) {
      // Image takes the top 58% of the page
      const imgH = Math.round(PAGE_SIZE * 0.58)
      const imgY = PAGE_SIZE - imgH
      const dims = embeddedImg.scaleToFit(PAGE_SIZE - MARGIN * 2, imgH - MARGIN / 2)
      storyPage.drawImage(embeddedImg, {
        x: (PAGE_SIZE - dims.width) / 2,
        y: imgY + (imgH - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      })

      // Text in the bottom 36%
      const textAreaTop = imgY - 10
      drawPageText(storyPage, scene.page_text, fontSerif, textAreaTop, scene.page_number, scenes.length)
    } else {
      // No image — center the text vertically
      const textAreaTop = Math.round(PAGE_SIZE * 0.72)
      drawPageText(storyPage, scene.page_text, fontSerif, textAreaTop, scene.page_number, scenes.length)
    }
  }

  // ── Back page ──────────────────────────────────────────────────────────────
  const backPage = doc.addPage([PAGE_SIZE, PAGE_SIZE])
  backPage.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: PAGE_SIZE, color: CREAM })
  backPage.drawRectangle({ x: 0, y: PAGE_SIZE - 8, width: PAGE_SIZE, height: 8, color: BRAND_GOLD })
  backPage.drawRectangle({ x: 0, y: 0, width: PAGE_SIZE, height: 8, color: BRAND_GOLD })

  const endText = '✦  The End  ✦'
  const endW = fontSerifItalic.widthOfTextAtSize(endText, 20)
  backPage.drawText(endText, {
    x: (PAGE_SIZE - endW) / 2,
    y: PAGE_SIZE / 2 + 10,
    size: 20,
    font: fontSerifItalic,
    color: BRAND_GOLD,
  })

  const brandText = 'A Nest & Quill Original'
  const brandW = fontSerif.widthOfTextAtSize(brandText, 11)
  backPage.drawText(brandText, {
    x: (PAGE_SIZE - brandW) / 2,
    y: PAGE_SIZE / 2 - 24,
    size: 11,
    font: fontSerif,
    color: GRAY,
  })

  const pdfBytes = await doc.save()
  const buffer = Buffer.from(pdfBytes)

  return {
    buffer,
    pageCount: doc.getPageCount(),
    renderTimeMs: Date.now() - t0,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  size: number,
  maxWidth: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function drawPageText(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  topY: number,
  pageNum: number,
  totalPages: number
) {
  const textSize = 13
  const maxTextW = PAGE_SIZE - MARGIN * 3
  const lines = wrapText(text, font, textSize, maxTextW)
  let y = topY

  for (const line of lines) {
    if (y < MARGIN + 20) break
    page.drawText(line, { x: MARGIN * 1.5, y, size: textSize, font, color: CHARCOAL })
    y -= textSize * 1.75
  }

  // Page number — bottom center
  const pageLabel = `${pageNum} / ${totalPages}`
  const labelW = font.widthOfTextAtSize(pageLabel, 9)
  page.drawText(pageLabel, {
    x: (PAGE_SIZE - labelW) / 2,
    y: MARGIN / 2,
    size: 9,
    font,
    color: rgb(0.7, 0.68, 0.66),
  })
}
