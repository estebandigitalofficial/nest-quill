// Client-side PDF text extraction for the Admin Writer import flow.
//
// Runs in the browser via PDF.js (avoids serverless parsing issues). It is
// LAYOUT-AWARE: it groups text items into visual lines by vertical position,
// then starts a new paragraph using two positional signals — never sentence
// structure and never AI:
//
//   1. Vertical gap: a line gap clearly larger than the normal line height
//      (the extra spacing a typesetter inserts between paragraphs). The
//      threshold is found by clustering all inter-line gaps in the document
//      into "line spacing" vs "paragraph spacing" and splitting at the midpoint
//      — robust even on pages where paragraph gaps outnumber line gaps (a plain
//      median miscalibrates there).
//   2. First-line indentation: a line whose left edge is indented past the body
//      margin starts a new paragraph even when the vertical gap is normal
//      (standard book typography that indents instead of adding blank lines).
//
// It only changes whitespace/paragraph breaks — words are preserved exactly.
//
// Output format: one paragraph per line ('\n'-separated). Running headers and
// page numbers are left in place (each lands as its own short paragraph) and are
// stripped later, faithfully, by cleanChapterBody() in parseManuscript.ts.

interface TextItemLike {
  str?: string
  transform?: number[] // [a, b, c, d, x, y] — index 4 = x, index 5 = y
}

interface Line {
  x: number // left edge of the line
  y: number // vertical position (higher = nearer top of page)
  text: string
}

// Group a page's items into visual lines (by y), left-to-right within each line.
function pageToLines(items: TextItemLike[]): Line[] {
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

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0]) // top to bottom (descending y)
    .map(([y, its]) => {
      its.sort((a, b) => a.transform![4] - b.transform![4]) // left to right
      return {
        y,
        x: its[0].transform![4],
        text: its.map(i => i.str!).join(' ').replace(/\s+/g, ' ').trim(),
      }
    })
    .filter(l => l.text)
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Cluster inter-line gaps into two groups (line spacing vs paragraph spacing)
// with a 1-D 2-means and return the midpoint between the centroids. Returns null
// when there aren't enough samples or the gaps form a single cluster (no reliable
// paragraph spacing) — the caller then falls back to a median-based threshold.
function twoClusterThreshold(gaps: number[]): number | null {
  const arr = gaps.filter(g => g > 0 && g < 45).sort((a, b) => a - b)
  if (arr.length < 4) return null

  let lo = arr[0]
  let hi = arr[arr.length - 1]
  if (hi - lo < 4) return null

  for (let iter = 0; iter < 12; iter++) {
    const mid = (lo + hi) / 2
    const low = arr.filter(v => v <= mid)
    const high = arr.filter(v => v > mid)
    if (!low.length || !high.length) break
    const nlo = low.reduce((a, b) => a + b, 0) / low.length
    const nhi = high.reduce((a, b) => a + b, 0) / high.length
    if (nlo === lo && nhi === hi) break
    lo = nlo
    hi = nhi
  }

  // Clusters must be clearly separated to trust them as line vs paragraph spacing.
  if (hi / lo < 1.4) return null
  return (lo + hi) / 2
}

const INDENT_MIN = 5 // pts past the body margin to count as a first-line indent
const INDENT_MAX = 40 // beyond this it's a centered heading / page number, not an indent

function linesToParagraphs(lines: Line[], gapThreshold: number): string[] {
  if (lines.length === 0) return []

  const base = Math.min(...lines.map(l => l.x)) // body left margin for this page

  const paragraphs: string[] = []
  let current = [lines[0].text]
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y
    const indent = lines[i].x - base
    const isIndented = indent >= INDENT_MIN && indent <= INDENT_MAX
    if (gap > gapThreshold || isIndented) {
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

  // Pass 1: collect every page's lines (with positions).
  const pages: Line[][] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(pageToLines(content.items as TextItemLike[]))
  }

  // Compute a single, document-wide paragraph-gap threshold.
  const allGaps: number[] = []
  for (const lines of pages) {
    for (let i = 1; i < lines.length; i++) {
      const d = lines[i - 1].y - lines[i].y
      if (d > 0 && d < 45) allGaps.push(d)
    }
  }
  const med = median(allGaps)
  const gapThreshold = twoClusterThreshold(allGaps) ?? (med != null ? med * 1.5 : 24)

  // Pass 2: form paragraphs per page using the global gap threshold + indentation.
  const paragraphs: string[] = []
  for (const lines of pages) {
    paragraphs.push(...linesToParagraphs(lines, gapThreshold))
  }

  return paragraphs.join('\n').trim()
}
