// Client-side PDF text extraction for the Admin Writer import flow.
//
// Runs in the browser via PDF.js (avoids serverless parsing issues). Unlike a
// naive items.join(' '), this is PARAGRAPH-AWARE: it groups text into visual
// lines by vertical position, then starts a new paragraph when the gap between
// lines is noticeably larger than the normal line height (the blank-line spacing
// a typesetter inserts between paragraphs). This preserves paragraph breaks that
// a flat join would destroy. It never changes words — only whitespace/layout.
//
// Output format: one paragraph per line ('\n'-separated). Running headers and
// page numbers are left in place (each lands as its own short paragraph) and are
// stripped later, faithfully, by cleanChapterBody() in parseManuscript.ts.

interface TextItemLike {
  str?: string
  transform?: number[] // [a, b, c, d, x, y] — index 4 = x, index 5 = y
}

function pageToParagraphs(items: TextItemLike[]): string[] {
  // Group items into visual lines by y position (bucket within 3 units).
  const buckets = new Map<number, TextItemLike[]>()
  for (const it of items) {
    const str = it?.str
    if (!str || !str.trim() || !it.transform) continue
    const y = Math.round(it.transform[5])
    let key: number | null = null
    for (const k of buckets.keys()) {
      if (Math.abs(k - y) <= 3) { key = k; break }
    }
    if (key === null) { key = y; buckets.set(key, []) }
    buckets.get(key)!.push(it)
  }

  const lines = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0]) // top to bottom (descending y)
    .map(([y, its]) => ({
      y,
      text: its
        .sort((a, b) => (a.transform![4] - b.transform![4])) // left to right
        .map(i => i.str!)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter(l => l.text)

  if (lines.length === 0) return []

  // Line height = median of small inter-line gaps; paragraph break = gap > 1.5×.
  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i - 1].y - lines[i].y
    if (d > 0 && d < 40) gaps.push(d)
  }
  gaps.sort((a, b) => a - b)
  const lineHeight = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 16
  const threshold = lineHeight * 1.5

  const paragraphs: string[] = []
  let current = [lines[0].text]
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y
    if (gap > threshold) {
      paragraphs.push(current.join(' '))
      current = [lines[i].text]
    } else {
      current.push(lines[i].text)
    }
  }
  paragraphs.push(current.join(' '))

  return paragraphs.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const paragraphs: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    paragraphs.push(...pageToParagraphs(content.items as TextItemLike[]))
  }

  return paragraphs.join('\n').trim()
}
